// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {RegistryErrors} from "./errors/RegistryErrors.sol";
import {IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";
import {IComplianceModule} from "./interfaces/IComplianceModule.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {LedgerChain} from "./libraries/LedgerChain.sol";

/// @notice Lifecycle state of a registered asset.
enum AssetState {
    Unknown,
    Active,
    Paused,
    Frozen
}

/// @notice Status of a DvP transfer request on Ethereum.
enum RequestStatus {
    None,
    Pending,
    Approved,
    Rejected,
    Expired,
    Reconciled
}

/// @notice Decision outcome mirrored in TRANSFER_DECISION.outcome (PROTOCOLO).
enum DecisionOutcome {
    Approved,
    Rejected,
    Expired
}

/// @notice Reason codes for Rejected decisions (0 = none / Approved / Expired).
library ReasonCode {
    uint8 internal constant NONE = 0;
    uint8 internal constant NOT_VERIFIED = 1;
    uint8 internal constant CERTIFICATION_EXPIRED = 2;
    uint8 internal constant ASSET_FROZEN = 3;
    uint8 internal constant ASSET_NOT_ACTIVE = 4;
    uint8 internal constant INSUFFICIENT_BALANCE = 5;
    // Compliance failures reuse the module ruleId (Country=1, MaxHolders=2, Lockup=3, …).
}

/// @notice Pending / decided transfer request (D4).
struct TransferRequest {
    bytes32 transferId;
    bytes32 assetId;
    bytes32 seller;
    bytes32 buyer;
    uint256 amount;
    uint64 deadline;
    RequestStatus status;
    uint8 reasonCode;
}

/// @title TitleRegistry
/// @notice Canonical unit ledger keyed by `(assetId, Solana holder pubkey)`.
contract TitleRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant COURT_ROLE = keccak256("COURT_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    IIdentityRegistry public identityRegistry;
    IAttestationRegistry public attestationRegistry;

    mapping(bytes32 assetId => AssetState state) public assetState;
    mapping(bytes32 assetId => mapping(bytes32 holder => uint256 balance)) public balanceOf;
    mapping(bytes32 assetId => uint256 issued) public totalIssued;
    mapping(bytes32 assetId => uint256 redeemed) public totalRedeemed;
    mapping(bytes32 assetId => bytes32[] entryHashes) private _entryHashes;
    mapping(bytes32 assetId => bytes32[] dataHashes) private _dataHashes;
    mapping(bytes32 transferId => TransferRequest request) public requests;

    IComplianceModule[] public complianceModules;

    event AssetCreated(bytes32 indexed assetId, AssetState state);
    event AssetStateChanged(bytes32 indexed assetId, AssetState previous, AssetState next);
    event Issued(bytes32 indexed assetId, bytes32 indexed to, uint256 amount, bytes32 entryHash);
    event TransferRequestRegistered(
        bytes32 indexed transferId,
        bytes32 indexed assetId,
        bytes32 seller,
        bytes32 buyer,
        uint256 amount,
        uint64 deadline
    );
    event TransferDecided(bytes32 indexed transferId, DecisionOutcome outcome, uint8 reasonCode, bytes32 entryHash);
    event ForcedTransfer(
        bytes32 indexed assetId,
        bytes32 indexed from,
        bytes32 indexed to,
        uint256 amount,
        bytes32 resolutionHash,
        bytes32 entryHash
    );
    event Reconciled(bytes32 indexed transferId, bytes32 resolutionHash, bytes32 entryHash);
    event Redeemed(bytes32 indexed assetId, bytes32 indexed holder, uint256 amount, bytes32 entryHash);
    event ComplianceModuleAdded(address indexed module, uint8 ruleId);
    event ComplianceModuleRemoved(address indexed module, uint8 ruleId);
    event RegistriesUpdated(address identity, address attestation);

    /// @param admin DEFAULT_ADMIN_ROLE (distinct from issuer/operator/court).
    /// @param issuer ISSUER_ROLE.
    /// @param operator OPERATOR_ROLE.
    /// @param court COURT_ROLE.
    /// @param identity Identity registry.
    /// @param attestation Attestation registry (mock OK in TITLE; full in ATTEST).
    constructor(address admin, address issuer, address operator, address court, address identity, address attestation) {
        if (
            admin == address(0) || issuer == address(0) || operator == address(0) || court == address(0)
                || identity == address(0) || attestation == address(0)
        ) {
            revert RegistryErrors.ZeroAddress();
        }
        if (admin == issuer) {
            revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, ISSUER_ROLE);
        }
        if (admin == operator) {
            revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, OPERATOR_ROLE);
        }
        if (admin == court) {
            revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, COURT_ROLE);
        }
        if (issuer == operator) {
            revert RegistryErrors.RoleOverlap(ISSUER_ROLE, OPERATOR_ROLE);
        }
        if (issuer == court) {
            revert RegistryErrors.RoleOverlap(ISSUER_ROLE, COURT_ROLE);
        }
        if (operator == court) {
            revert RegistryErrors.RoleOverlap(OPERATOR_ROLE, COURT_ROLE);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(COURT_ROLE, court);

        identityRegistry = IIdentityRegistry(identity);
        attestationRegistry = IAttestationRegistry(attestation);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setRegistries(address identity, address attestation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (identity == address(0) || attestation == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        identityRegistry = IIdentityRegistry(identity);
        attestationRegistry = IAttestationRegistry(attestation);
        emit RegistriesUpdated(identity, attestation);
    }

    function addComplianceModule(address module) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (module == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        complianceModules.push(IComplianceModule(module));
        emit ComplianceModuleAdded(module, IComplianceModule(module).ruleId());
    }

    function removeComplianceModule(uint256 index) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 len = complianceModules.length;
        if (index >= len) {
            revert RegistryErrors.Unauthorized();
        }
        IComplianceModule module = complianceModules[index];
        complianceModules[index] = complianceModules[len - 1];
        complianceModules.pop();
        emit ComplianceModuleRemoved(address(module), module.ruleId());
    }

    function createAsset(bytes32 assetId) external onlyRole(ISSUER_ROLE) {
        if (assetId == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (assetState[assetId] != AssetState.Unknown) {
            revert RegistryErrors.AssetNotActive(assetId);
        }
        assetState[assetId] = AssetState.Active;
        emit AssetCreated(assetId, AssetState.Active);
    }

    function setAssetState(bytes32 assetId, AssetState next) external {
        AssetState prev = assetState[assetId];
        if (prev == AssetState.Unknown) {
            revert RegistryErrors.AssetUnknown(assetId);
        }
        if (next == AssetState.Unknown || next == prev) {
            revert RegistryErrors.AssetNotActive(assetId);
        }

        if (next == AssetState.Frozen) {
            if (!hasRole(COURT_ROLE, msg.sender) && !hasRole(OPERATOR_ROLE, msg.sender)) {
                revert RegistryErrors.Unauthorized();
            }
        } else if (next == AssetState.Paused || next == AssetState.Active) {
            _checkRole(OPERATOR_ROLE);
        } else {
            revert RegistryErrors.Unauthorized();
        }

        assetState[assetId] = next;
        emit AssetStateChanged(assetId, prev, next);
    }

    // -------------------------------------------------------------------------
    // Issue / redeem / forced
    // -------------------------------------------------------------------------

    /// @notice Issue units to a verified holder when the asset is certified (D1 / ISSUE path).
    function issue(bytes32 assetId, uint256 amount, bytes32 toHolder) external onlyRole(ISSUER_ROLE) {
        if (amount == 0) {
            revert RegistryErrors.ZeroAmount();
        }
        if (toHolder == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (assetState[assetId] != AssetState.Active) {
            revert RegistryErrors.AssetNotActive(assetId);
        }
        if (!attestationRegistry.isCertified(assetId)) {
            revert RegistryErrors.CertificationExpired(assetId);
        }
        if (!identityRegistry.isVerified(toHolder)) {
            revert RegistryErrors.NotVerified(toHolder);
        }

        uint256 newBal = balanceOf[assetId][toHolder] + amount;
        balanceOf[assetId][toHolder] = newBal;
        totalIssued[assetId] += amount;

        bytes32 dataHash = keccak256(abi.encode("ISSUE", assetId, toHolder, amount, block.timestamp));
        bytes32 entry = _appendEntry(assetId, dataHash);
        _notifyModules(assetId, bytes32(0), toHolder, 0, newBal);
        emit Issued(assetId, toHolder, amount, entry);
    }

    /// @notice Court-ordered move (bypasses compliance; still requires Active or Frozen source of truth).
    function forcedTransfer(bytes32 assetId, bytes32 from, bytes32 to, uint256 amount, bytes32 resolutionHash)
        external
        onlyRole(COURT_ROLE)
    {
        if (amount == 0) {
            revert RegistryErrors.ZeroAmount();
        }
        if (from == bytes32(0) || to == bytes32(0) || resolutionHash == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (assetState[assetId] == AssetState.Unknown) {
            revert RegistryErrors.AssetUnknown(assetId);
        }

        uint256 fromBal = balanceOf[assetId][from];
        if (fromBal < amount) {
            revert RegistryErrors.InsufficientBalance(assetId, from);
        }

        uint256 newFrom = fromBal - amount;
        uint256 newTo = balanceOf[assetId][to] + amount;
        balanceOf[assetId][from] = newFrom;
        balanceOf[assetId][to] = newTo;

        bytes32 dataHash = keccak256(abi.encode("FORCED", assetId, from, to, amount, resolutionHash, block.timestamp));
        bytes32 entry = _appendEntry(assetId, dataHash);
        _notifyModules(assetId, from, to, newFrom, newTo);
        emit ForcedTransfer(assetId, from, to, amount, resolutionHash, entry);
    }

    /// @notice Burn units in-kind (court/issuer close-out); maintains I1.
    function redeemInKind(bytes32 assetId, bytes32 holder, uint256 amount) external onlyRole(COURT_ROLE) {
        if (amount == 0) {
            revert RegistryErrors.ZeroAmount();
        }
        if (holder == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (assetState[assetId] == AssetState.Unknown) {
            revert RegistryErrors.AssetUnknown(assetId);
        }

        uint256 bal = balanceOf[assetId][holder];
        if (bal < amount) {
            revert RegistryErrors.InsufficientBalance(assetId, holder);
        }

        uint256 newBal = bal - amount;
        balanceOf[assetId][holder] = newBal;
        totalRedeemed[assetId] += amount;

        bytes32 dataHash = keccak256(abi.encode("REDEEM", assetId, holder, amount, block.timestamp));
        bytes32 entry = _appendEntry(assetId, dataHash);
        _notifyModules(assetId, holder, bytes32(0), newBal, 0);
        emit Redeemed(assetId, holder, amount, entry);
    }

    // -------------------------------------------------------------------------
    // Transfer requests + decide (D4)
    // -------------------------------------------------------------------------

    /// @notice Register a Solana→Eth TRANSFER_REQUEST (called by BridgeEndpoint later).
    function onTransferRequest(
        bytes32 transferId,
        bytes32 assetId,
        bytes32 seller,
        bytes32 buyer,
        uint256 amount,
        uint64 deadline
    ) external onlyRole(BRIDGE_ROLE) {
        if (transferId == bytes32(0) || assetId == bytes32(0) || seller == bytes32(0) || buyer == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (amount == 0) {
            revert RegistryErrors.ZeroAmount();
        }
        if (requests[transferId].status != RequestStatus.None) {
            revert RegistryErrors.RequestAlreadyExists(transferId);
        }
        if (assetState[assetId] == AssetState.Unknown) {
            revert RegistryErrors.AssetUnknown(assetId);
        }

        requests[transferId] = TransferRequest({
            transferId: transferId,
            assetId: assetId,
            seller: seller,
            buyer: buyer,
            amount: amount,
            deadline: deadline,
            status: RequestStatus.Pending,
            reasonCode: ReasonCode.NONE
        });
        emit TransferRequestRegistered(transferId, assetId, seller, buyer, amount, deadline);
    }

    /// @notice Operator decision engine: Approved / Rejected / Expired per D4 + I7.
    function decide(bytes32 transferId) external onlyRole(OPERATOR_ROLE) returns (DecisionOutcome outcome) {
        TransferRequest storage req = requests[transferId];
        if (req.status != RequestStatus.Pending) {
            revert RegistryErrors.RequestNotPending(transferId);
        }

        uint8 reason = ReasonCode.NONE;
        bytes32 entry = bytes32(0);

        if (block.timestamp > req.deadline) {
            outcome = DecisionOutcome.Expired;
            req.status = RequestStatus.Expired;
        } else {
            (bool ok, uint8 failReason) = _evaluateApproval(req);
            if (!ok) {
                outcome = DecisionOutcome.Rejected;
                reason = failReason;
                req.status = RequestStatus.Rejected;
                req.reasonCode = reason;
            } else {
                outcome = DecisionOutcome.Approved;
                req.status = RequestStatus.Approved;
                entry = _applyApproved(req);
            }
        }

        emit TransferDecided(transferId, outcome, reason, entry);
    }

    /// @notice D6 reconciler path: undo an Approved move that Solana rejected after hardDeadline.
    function reconcile(bytes32 transferId, bytes32 resolutionHash) external onlyRole(OPERATOR_ROLE) {
        if (resolutionHash == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        TransferRequest storage req = requests[transferId];
        if (req.status != RequestStatus.Approved) {
            revert RegistryErrors.RequestNotPending(transferId);
        }

        bytes32 assetId = req.assetId;
        uint256 buyerBal = balanceOf[assetId][req.buyer];
        if (buyerBal < req.amount) {
            revert RegistryErrors.InsufficientBalance(assetId, req.buyer);
        }

        uint256 newBuyer = buyerBal - req.amount;
        uint256 newSeller = balanceOf[assetId][req.seller] + req.amount;
        balanceOf[assetId][req.buyer] = newBuyer;
        balanceOf[assetId][req.seller] = newSeller;
        req.status = RequestStatus.Reconciled;

        bytes32 dataHash = keccak256(abi.encode("RECONCILE", transferId, resolutionHash, req.amount, block.timestamp));
        bytes32 entry = _appendEntry(assetId, dataHash);
        _notifyModules(assetId, req.buyer, req.seller, newBuyer, newSeller);
        emit Reconciled(transferId, resolutionHash, entry);
    }

    // -------------------------------------------------------------------------
    // Views (I1 / I9)
    // -------------------------------------------------------------------------

    function complianceModuleCount() external view returns (uint256) {
        return complianceModules.length;
    }

    function entryCount(bytes32 assetId) external view returns (uint256) {
        return _entryHashes[assetId].length;
    }

    function entryHash(bytes32 assetId, uint256 index) external view returns (bytes32) {
        return _entryHashes[assetId][index];
    }

    function dataHashAt(bytes32 assetId, uint256 index) external view returns (bytes32) {
        return _dataHashes[assetId][index];
    }

    /// @notice I1 helper: circulating units = issued − redeemed.
    function circulating(bytes32 assetId) public view returns (uint256) {
        return totalIssued[assetId] - totalRedeemed[assetId];
    }

    /// @notice I9: verify on-chain ledger chain for an asset.
    function verifyLedger(bytes32 assetId) external view returns (bool) {
        return LedgerChain.verifyChain(_entryHashes[assetId], _dataHashes[assetId]);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _evaluateApproval(TransferRequest storage req) internal view returns (bool ok, uint8 reason) {
        if (!identityRegistry.isVerified(req.buyer)) {
            return (false, ReasonCode.NOT_VERIFIED);
        }
        if (!attestationRegistry.isCertified(req.assetId)) {
            return (false, ReasonCode.CERTIFICATION_EXPIRED);
        }

        AssetState st = assetState[req.assetId];
        if (st == AssetState.Frozen) {
            return (false, ReasonCode.ASSET_FROZEN);
        }
        if (st != AssetState.Active) {
            return (false, ReasonCode.ASSET_NOT_ACTIVE);
        }

        if (balanceOf[req.assetId][req.seller] < req.amount) {
            return (false, ReasonCode.INSUFFICIENT_BALANCE);
        }

        uint256 len = complianceModules.length;
        for (uint256 i; i < len; ++i) {
            IComplianceModule mod = complianceModules[i];
            if (!mod.canTransfer(req.assetId, req.seller, req.buyer, req.amount)) {
                return (false, mod.ruleId());
            }
        }
        return (true, ReasonCode.NONE);
    }

    function _applyApproved(TransferRequest storage req) internal returns (bytes32 entry) {
        bytes32 assetId = req.assetId;
        uint256 fromBal = balanceOf[assetId][req.seller];
        uint256 newFrom = fromBal - req.amount;
        uint256 newTo = balanceOf[assetId][req.buyer] + req.amount;
        balanceOf[assetId][req.seller] = newFrom;
        balanceOf[assetId][req.buyer] = newTo;

        bytes32 dataHash = keccak256(
            abi.encode("TRANSFER", req.transferId, assetId, req.seller, req.buyer, req.amount, block.timestamp)
        );
        entry = _appendEntry(assetId, dataHash);
        _notifyModules(assetId, req.seller, req.buyer, newFrom, newTo);
    }

    function _appendEntry(bytes32 assetId, bytes32 dataHash) internal returns (bytes32 entry) {
        bytes32[] storage entries = _entryHashes[assetId];
        bytes32 prev = entries.length == 0 ? bytes32(0) : entries[entries.length - 1];
        entry = LedgerChain.nextHash(prev, dataHash);
        entries.push(entry);
        _dataHashes[assetId].push(dataHash);
    }

    function _notifyModules(bytes32 assetId, bytes32 from, bytes32 to, uint256 fromBalance, uint256 toBalance)
        internal
    {
        uint256 len = complianceModules.length;
        for (uint256 i; i < len; ++i) {
            complianceModules[i].onBalancesChanged(assetId, from, to, fromBalance, toBalance);
        }
    }
}
