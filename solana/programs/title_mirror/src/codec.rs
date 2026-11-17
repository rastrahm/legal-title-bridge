//! Canonical LTB packet codec (must match PacketCodec.sol and shared/codec.ts).

use anchor_lang::solana_program::keccak;

pub const PACKET_VERSION: u8 = 1;
pub const HEADER_SIZE: usize = 62;
pub const DOMAIN_TAG_STRING: &str = "LegalTitleBridge.Packet.v1";

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MsgType {
    Issue = 0,
    TransferRequest = 1,
    TransferDecision = 2,
    ForcedTransfer = 3,
}

impl MsgType {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Issue),
            1 => Some(Self::TransferRequest),
            2 => Some(Self::TransferDecision),
            3 => Some(Self::ForcedTransfer),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Packet {
    pub version: u8,
    pub src_chain: u64,
    pub dst_chain: u64,
    pub emitter: [u8; 32],
    pub epoch: u64,
    pub msg_type: MsgType,
    pub payload: Vec<u8>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CodecError {
    InvalidPacket,
    UnsupportedVersion(u8),
    UnsupportedMsgType(u8),
}

pub fn domain_tag() -> [u8; 32] {
    keccak::hash(DOMAIN_TAG_STRING.as_bytes()).to_bytes()
}

pub fn encode(packet: &Packet) -> Result<Vec<u8>, CodecError> {
    if packet.version != PACKET_VERSION {
        return Err(CodecError::UnsupportedVersion(packet.version));
    }
    let mt = packet.msg_type as u8;
    if MsgType::from_u8(mt).is_none() {
        return Err(CodecError::UnsupportedMsgType(mt));
    }
    if packet.payload.len() > u32::MAX as usize {
        return Err(CodecError::InvalidPacket);
    }

    let mut data = vec![0u8; HEADER_SIZE + packet.payload.len()];
    data[0] = packet.version;
    data[1..9].copy_from_slice(&packet.src_chain.to_be_bytes());
    data[9..17].copy_from_slice(&packet.dst_chain.to_be_bytes());
    data[17..49].copy_from_slice(&packet.emitter);
    data[49..57].copy_from_slice(&packet.epoch.to_be_bytes());
    data[57] = mt;
    data[58..62].copy_from_slice(&(packet.payload.len() as u32).to_be_bytes());
    data[62..].copy_from_slice(&packet.payload);
    Ok(data)
}

pub fn decode(data: &[u8]) -> Result<Packet, CodecError> {
    if data.len() < HEADER_SIZE {
        return Err(CodecError::InvalidPacket);
    }
    let version = data[0];
    if version != PACKET_VERSION {
        return Err(CodecError::UnsupportedVersion(version));
    }
    let src_chain = u64::from_be_bytes(data[1..9].try_into().unwrap());
    let dst_chain = u64::from_be_bytes(data[9..17].try_into().unwrap());
    let mut emitter = [0u8; 32];
    emitter.copy_from_slice(&data[17..49]);
    let epoch = u64::from_be_bytes(data[49..57].try_into().unwrap());
    let mt_raw = data[57];
    let msg_type = MsgType::from_u8(mt_raw).ok_or(CodecError::UnsupportedMsgType(mt_raw))?;
    let payload_len = u32::from_be_bytes(data[58..62].try_into().unwrap()) as usize;
    if data.len() != HEADER_SIZE + payload_len {
        return Err(CodecError::InvalidPacket);
    }
    Ok(Packet {
        version,
        src_chain,
        dst_chain,
        emitter,
        epoch,
        msg_type,
        payload: data[62..].to_vec(),
    })
}

pub fn message_id_of_wire(wire: &[u8]) -> [u8; 32] {
    keccak::hash(wire).to_bytes()
}

pub fn message_id(packet: &Packet) -> Result<[u8; 32], CodecError> {
    Ok(message_id_of_wire(&encode(packet)?))
}

pub fn signing_digest(packet: &Packet) -> Result<[u8; 32], CodecError> {
    let mid = message_id(packet)?;
    Ok(signing_digest_from_parts(
        packet.version,
        packet.src_chain,
        packet.dst_chain,
        &packet.emitter,
        packet.epoch,
        &mid,
    ))
}

pub fn signing_digest_from_parts(
    version: u8,
    src_chain: u64,
    dst_chain: u64,
    emitter: &[u8; 32],
    epoch: u64,
    message_id: &[u8; 32],
) -> [u8; 32] {
    let mut buf = [0u8; 121];
    buf[0..32].copy_from_slice(&domain_tag());
    buf[32] = version;
    buf[33..41].copy_from_slice(&src_chain.to_be_bytes());
    buf[41..49].copy_from_slice(&dst_chain.to_be_bytes());
    buf[49..81].copy_from_slice(emitter);
    buf[81..89].copy_from_slice(&epoch.to_be_bytes());
    buf[89..121].copy_from_slice(message_id);
    keccak::hash(&buf).to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn vectors_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../test/vectors/packets.json")
    }

    fn parse_hex(s: &str) -> Vec<u8> {
        let s = s.trim_start_matches("0x");
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn domain_tag_matches_spec() {
        assert_eq!(
            domain_tag(),
            keccak::hash(b"LegalTitleBridge.Packet.v1").to_bytes()
        );
    }

    #[test]
    fn roundtrip_sample() {
        let p = Packet {
            version: 1,
            src_chain: 31337,
            dst_chain: 100001,
            emitter: [0x11; 32],
            epoch: 1,
            msg_type: MsgType::Issue,
            payload: vec![0u8; 96],
        };
        let wire = encode(&p).unwrap();
        let d = decode(&wire).unwrap();
        assert_eq!(d, p);
    }

    #[test]
    fn golden_vectors_match_solidity() {
        let path = vectors_path();
        let raw =
            fs::read_to_string(&path).unwrap_or_else(|e| panic!("missing {}: {e}", path.display()));
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let count = v["count"].as_u64().unwrap();
        let vectors = v["vectors"].as_array().unwrap();
        assert_eq!(count as usize, vectors.len());

        for item in vectors {
            let wire = parse_hex(item["wire"].as_str().unwrap());
            let expected_id = parse_hex(item["messageId"].as_str().unwrap());
            let expected_digest = parse_hex(item["signingDigest"].as_str().unwrap());

            let packet = decode(&wire).expect("decode");
            assert_eq!(encode(&packet).unwrap(), wire);
            assert_eq!(message_id_of_wire(&wire).to_vec(), expected_id);
            assert_eq!(signing_digest(&packet).unwrap().to_vec(), expected_digest);
        }
    }
}
