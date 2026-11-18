use anchor_lang::prelude::*;

#[error_code]
pub enum MirrorError {
    #[msg("Zero address / empty key")]
    ZeroAddress,
    #[msg("Threshold too low: need n>=3 and threshold >= ceil(2n/3)")]
    ThresholdTooLow,
    #[msg("Invalid relayer set (duplicate or empty)")]
    InvalidRelayerSet,
    #[msg("Too many relayers")]
    TooManyRelayers,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Paused")]
    Paused,
    #[msg("Wrong domain (chain / emitter / epoch / version)")]
    WrongDomain,
    #[msg("Invalid quorum")]
    InvalidQuorum,
    #[msg("Instructions sysvar address mismatch (R3)")]
    InvalidInstructionsSysvar,
    #[msg("Message already processed (I3)")]
    MessageAlreadyProcessed,
    #[msg("Unsupported message type")]
    UnsupportedMsgType,
    #[msg("Invalid packet / payload")]
    InvalidPacket,
    #[msg("Unauthorized transfer path (I5)")]
    UnauthorizedTransferPath,
    #[msg("Mint mismatch (R4)")]
    MintMismatch,
    #[msg("Config mismatch (R4)")]
    ConfigMismatch,
}
