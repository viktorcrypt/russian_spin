// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RussianSpin {
    struct Session {
        uint8 level;    
        bool alive;     
        uint64 nonce;    
        uint256 points;  
    }

    mapping(address => Session) public sessions;
    mapping(address => uint256) public bestScore;

    uint256 public globalBest;
    address public globalBestPlayer;

    event GameStarted(address indexed player, uint8 level, uint256 points, uint64 nonce);
    event Spun(
        address indexed player,
        uint8 levelBefore,
        uint8 bullets,
        uint8 roll,        // 0..5
        bool dead,
        uint256 pointsAfter,
        uint8 levelAfter
    );
    event CashedOut(address indexed player, uint256 points, uint256 bestScore);
    event GameOver(address indexed player, uint8 atLevel, uint256 finalPoints);

    error SessionNotActive();
    error NothingToCash();


    function start() external {
        Session storage s = sessions[msg.sender];
        s.level = 1;
        s.points = 10;
        s.alive = true;
        unchecked { s.nonce += 1; }
        emit GameStarted(msg.sender, s.level, s.points, s.nonce);
    }

    function spin() external {
        Session storage s = sessions[msg.sender];
        if (!s.alive || s.level == 0) revert SessionNotActive();

        uint8 levelBefore = s.level;
        uint8 bullets = levelBefore > 5 ? 5 : levelBefore;

        
        uint256 entropy = block.prevrandao; // uint256
        if (entropy == 0) {
            entropy = uint256(blockhash(block.number - 1));
        }

        uint256 rnd = uint256(
            keccak256(
                abi.encodePacked(
                    entropy,
                    block.number,
                    msg.sender,
                    s.nonce
                )
            )
        );
        uint8 roll = uint8(rnd % 6);
        bool dead = roll < bullets;

        if (dead) {
            s.points = 0;
            s.alive = false;
            emit Spun(msg.sender, levelBefore, bullets, roll, true, 0, levelBefore);
            emit GameOver(msg.sender, levelBefore, 0);
        } else {
            s.points = s.points * 10;
            s.level = levelBefore + 1;
            emit Spun(msg.sender, levelBefore, bullets, roll, false, s.points, s.level);
        }
    }

    function cashOut() external {
        Session storage s = sessions[msg.sender];
        if (!s.alive || s.level == 0) revert SessionNotActive();
        if (s.points <= 10) revert NothingToCash();

        uint256 pts = s.points;

        
        s.alive = false;
        emit GameOver(msg.sender, s.level, pts);

        
        if (pts > bestScore[msg.sender]) bestScore[msg.sender] = pts;
        if (pts > globalBest) {
            globalBest = pts;
            globalBestPlayer = msg.sender;
        }

        emit CashedOut(msg.sender, pts, bestScore[msg.sender]);
    }

    
    function getSession(address player)
        external
        view
        returns (uint8 level, bool alive, uint64 nonce, uint256 points)
    {
        Session storage s = sessions[player];
        return (s.level, s.alive, s.nonce, s.points);
    }
}
