// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev Callback sink for P5 reentrancy demo.
interface ICallback {
    function onPaid(bytes32 transferId) external;
}

/// @title VulnerableTitleDecide
/// @notice INTENTIONALLY VULNERABLE — skips identity / certification / deadline (P5/P6/M3–M5).
contract VulnerableTitleDecide {
    enum Status {
        None,
        Pending,
        Approved,
        Rejected,
        Expired
    }

    struct Request {
        address buyer;
        uint256 amount;
        uint64 deadline;
        Status status;
    }

    mapping(bytes32 => Request) public requests;
    mapping(bytes32 => mapping(address => uint256)) public balanceOf;
    mapping(address => uint256) public ethPaid; // mock payment hook target

    function register(bytes32 id, address buyer, uint256 amount, uint64 deadline) external {
        requests[id] = Request({buyer: buyer, amount: amount, deadline: deadline, status: Status.Pending});
    }

    function fund(bytes32 assetId, address who, uint256 amount) external {
        balanceOf[assetId][who] += amount;
    }

    /// @notice P6 vulnerable: always Approves without identity/cert checks.
    function decideBlind(bytes32 id, bytes32 assetId, address seller) external returns (Status) {
        Request storage req = requests[id];
        require(req.status == Status.Pending, "not pending");
        // Missing: timestamp > deadline → Expired (M3)
        // Missing: identity / certification (M4/M5)
        req.status = Status.Approved;
        balanceOf[assetId][seller] -= req.amount;
        balanceOf[assetId][req.buyer] += req.amount;
        return Status.Approved;
    }

    /// @notice P5 vulnerable: external call before status update (reentrancy).
    function payThenFinalize(bytes32 id, address payable tokenLike) external {
        Request storage req = requests[id];
        require(req.status == Status.Pending, "not pending");
        uint256 amt = req.amount;
        // Effects after interaction — classic bug.
        ICallback(tokenLike).onPaid(id);
        ethPaid[req.buyer] += amt;
        req.status = Status.Approved;
    }

    /// @notice Hardened CEI pattern used as the "real" control in the same file for contrast.
    function payThenFinalizeSafe(bytes32 id, address payable tokenLike) external {
        Request storage req = requests[id];
        require(req.status == Status.Pending, "not pending");
        req.status = Status.Approved; // effect first
        uint256 amt = req.amount;
        ethPaid[req.buyer] += amt;
        ICallback(tokenLike).onPaid(id); // interaction last
    }
}

/// @notice Attacker reenters VulnerableTitleDecide.payThenFinalize.
contract ReentrancyAttacker {
    VulnerableTitleDecide public target;
    bytes32 public id;
    uint256 public hits;

    constructor(VulnerableTitleDecide target_) {
        target = target_;
    }

    function arm(bytes32 id_) external {
        id = id_;
    }

    function onPaid(bytes32) external {
        unchecked {
            ++hits;
        }
        if (hits < 2) {
            target.payThenFinalize(id, payable(address(this)));
        }
    }
}
