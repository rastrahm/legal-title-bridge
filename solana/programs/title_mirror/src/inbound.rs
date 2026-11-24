//! Shared Eth→Sol inbound packet checks and payload parsers for `apply_*` instructions.
//! Keeps wire layout identical to PROTOCOLO / PacketCodec (no ABI/IDL change).

use anchor_lang::prelude::*;

use crate::codec::{self, MsgType, Packet};
use crate::errors::MirrorError;
use crate::quorum;
use crate::state::Config;

/// Ensure `message_id` matches keccak of the wire bytes (I3 / replay binding).
pub fn require_message_id(wire: &[u8], message_id: &[u8; 32]) -> Result<()> {
    require!(
        codec::message_id_of_wire(wire) == *message_id,
        MirrorError::InvalidPacket
    );
    Ok(())
}

/// Domain checks for messages emitted by the configured Eth endpoint toward Solana.
pub fn require_eth_inbound_domain(packet: &Packet, config: &Config) -> Result<()> {
    require!(
        packet.version == codec::PACKET_VERSION,
        MirrorError::WrongDomain
    );
    require!(
        packet.dst_chain == config.local_chain_id,
        MirrorError::WrongDomain
    );
    require!(
        packet.src_chain == config.remote_chain_id,
        MirrorError::WrongDomain
    );
    require!(
        packet.emitter == config.eth_endpoint,
        MirrorError::WrongDomain
    );
    require!(packet.epoch == config.epoch, MirrorError::WrongDomain);
    Ok(())
}

/// Decode uint256 big-endian word → u64 (high 24 bytes must fit in u64 via low 8).
pub fn u256_be_to_u64(word: &[u8]) -> Result<u64> {
    require!(word.len() == 32, MirrorError::InvalidPacket);
    let mut u64buf = [0u8; 8];
    u64buf.copy_from_slice(&word[24..32]);
    Ok(u64::from_be_bytes(u64buf))
}

fn copy32(src: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(src);
    out
}

/// ISSUE payload: assetId(32) ‖ amount(32) ‖ toHolder(32) = 96 bytes.
pub struct IssuePayload {
    pub asset_id: [u8; 32],
    pub amount: u64,
    pub to_holder: [u8; 32],
}

pub fn parse_issue_payload(payload: &[u8]) -> Result<IssuePayload> {
    require!(payload.len() == 96, MirrorError::InvalidPacket);
    let asset_id = copy32(&payload[0..32]);
    let amount = u256_be_to_u64(&payload[32..64])?;
    let to_holder = copy32(&payload[64..96]);
    require!(amount > 0, MirrorError::InvalidPacket);
    Ok(IssuePayload {
        asset_id,
        amount,
        to_holder,
    })
}

/// TRANSFER_DECISION payload: transferId(32) ‖ outcome(1) ‖ pad(1) ‖ amount(32) = 66 bytes.
pub struct DecisionPayload {
    pub transfer_id: [u8; 32],
    pub outcome: u8,
    pub amount: u64,
}

pub fn parse_decision_payload(payload: &[u8]) -> Result<DecisionPayload> {
    require!(payload.len() == 66, MirrorError::InvalidPacket);
    Ok(DecisionPayload {
        transfer_id: copy32(&payload[0..32]),
        outcome: payload[32],
        amount: u256_be_to_u64(&payload[34..66])?,
    })
}

/// FORCED_TRANSFER payload: assetId ‖ from ‖ to ‖ amount ‖ resolutionHash = 160 bytes.
pub struct ForcedPayload {
    pub asset_id: [u8; 32],
    pub from: [u8; 32],
    pub to: [u8; 32],
    pub amount: u64,
    pub resolution_hash: [u8; 32],
}

pub fn parse_forced_payload(payload: &[u8]) -> Result<ForcedPayload> {
    require!(payload.len() == 160, MirrorError::InvalidPacket);
    let asset_id = copy32(&payload[0..32]);
    let from = copy32(&payload[32..64]);
    let to = copy32(&payload[64..96]);
    let amount = u256_be_to_u64(&payload[96..128])?;
    let resolution_hash = copy32(&payload[128..160]);
    require!(amount > 0, MirrorError::InvalidPacket);
    require!(
        resolution_hash != [0u8; 32],
        MirrorError::MissingResolutionHash
    );
    Ok(ForcedPayload {
        asset_id,
        from,
        to,
        amount,
        resolution_hash,
    })
}

/// Decode wire, check type + domain, return packet for digest/quorum.
pub fn decode_typed_inbound(
    wire: &[u8],
    message_id: &[u8; 32],
    config: &Config,
    expected: MsgType,
) -> Result<Packet> {
    require_message_id(wire, message_id)?;
    let packet = codec::decode(wire).map_err(|_| MirrorError::InvalidPacket)?;
    require!(
        packet.msg_type == expected,
        MirrorError::UnsupportedMsgType
    );
    require_eth_inbound_domain(&packet, config)?;
    Ok(packet)
}

/// Verify secp256k1 quorum over the packet signing digest (R3).
pub fn verify_quorum<'info>(
    instructions_sysvar: &AccountInfo<'info>,
    packet: &Packet,
    config: &Config,
) -> Result<()> {
    let digest = codec::signing_digest(packet).map_err(|_| MirrorError::InvalidPacket)?;
    quorum::verify_secp256k1_quorum(
        instructions_sysvar,
        &digest,
        &config.relayers,
        config.relayer_count as usize,
        config.threshold,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn u256_be_to_u64_reads_low_bytes() {
        let mut word = [0u8; 32];
        word[31] = 7;
        word[30] = 1;
        assert_eq!(u256_be_to_u64(&word).unwrap(), 0x0107);
    }

    #[test]
    fn parse_issue_roundtrip_layout() {
        let mut payload = vec![0u8; 96];
        payload[0] = 0xaa;
        payload[63] = 5;
        payload[64] = 0xbb;
        let p = parse_issue_payload(&payload).unwrap();
        assert_eq!(p.amount, 5);
        assert_eq!(p.asset_id[0], 0xaa);
        assert_eq!(p.to_holder[0], 0xbb);
    }
}
