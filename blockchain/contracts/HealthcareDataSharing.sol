// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HealthcareDataSharing is ReentrancyGuard {
    enum Role {
        None,
        Patient,
        Doctor,
        Researcher
    }

    struct User {
        address wallet;
        string name;
        Role role;
        bool isRegistered;
    }

    struct MedicalRecord {
    uint256 recordId;
    address owner;
    string fileHash;
    string storageReference;
    uint256 createdAt;
    bool exists;
    bool isDeleted;
}

    struct AccessLog {
        uint256 recordId;
        address accessedBy;
        Role role;
        uint256 accessedAt;
    }

    mapping(address => User) private users;

    mapping(uint256 => MedicalRecord) private medicalRecords;

    // Records uploaded and owned by each patient or doctor.
    mapping(address => uint256[]) private ownerRecordIds;

    // recordId => user wallet => permission
    mapping(uint256 => mapping(address => bool))
        private recordAccess;

    mapping(uint256 => AccessLog[])
        private recordAccessLogs;

    uint256 private nextRecordId = 1;

    event UserRegistered(
        address indexed wallet,
        string name,
        Role role
    );
    event MedicalRecordDeleted(
    uint256 indexed recordId,
    address indexed owner,
    uint256 deletedAt
);

    event MedicalRecordAdded(
        uint256 indexed recordId,
        address indexed owner,
        string fileHash,
        string storageReference,
        uint256 createdAt
    );

    event AccessGranted(
        uint256 indexed recordId,
        address indexed owner,
        address indexed authorisedUser
    );

    event AccessRevoked(
        uint256 indexed recordId,
        address indexed owner,
        address indexed authorisedUser
    );

    event RecordAccessed(
        uint256 indexed recordId,
        address indexed accessedBy,
        Role role,
        uint256 accessedAt
    );

    modifier onlyRegisteredUser() {
        require(
            users[msg.sender].isRegistered,
            "User is not registered"
        );

        _;
    }

    modifier onlyRecordCreatorRole() {
        require(
            users[msg.sender].isRegistered,
            "User is not registered"
        );

        require(
            users[msg.sender].role == Role.Patient ||
                users[msg.sender].role == Role.Doctor,
            "Only patients or doctors can add records"
        );

        _;
    }

    modifier onlyRecordOwner(uint256 _recordId) {
        require(
            medicalRecords[_recordId].exists,
            "Medical record does not exist"
        );

        require(
            medicalRecords[_recordId].owner ==
                msg.sender,
            "Only the record owner can perform this action"
        );

        _;
    }

    function registerUser(
        string memory _name,
        Role _role
    ) public {
        require(
            !users[msg.sender].isRegistered,
            "User already registered"
        );

        require(
            bytes(_name).length > 0,
            "Name cannot be empty"
        );

        require(
            _role != Role.None,
            "Invalid role"
        );

        users[msg.sender] = User({
            wallet: msg.sender,
            name: _name,
            role: _role,
            isRegistered: true
        });

        emit UserRegistered(
            msg.sender,
            _name,
            _role
        );
    }

    function addMedicalRecord(
        string memory _fileHash,
        string memory _storageReference
    )
        public
        nonReentrant
        onlyRecordCreatorRole
        returns (uint256)
    {
        require(
            bytes(_fileHash).length > 0,
            "File hash cannot be empty"
        );

        require(
            bytes(_storageReference).length > 0,
            "Storage reference cannot be empty"
        );

        uint256 recordId = nextRecordId;

        medicalRecords[recordId] = MedicalRecord({
    recordId: recordId,
    owner: msg.sender,
    fileHash: _fileHash,
    storageReference: _storageReference,
    createdAt: block.timestamp,
    exists: true,
    isDeleted: false
});

        ownerRecordIds[msg.sender].push(recordId);

        nextRecordId++;

        emit MedicalRecordAdded(
            recordId,
            msg.sender,
            _fileHash,
            _storageReference,
            block.timestamp
        );

        return recordId;
    }

    function grantAccess(
        uint256 _recordId,
        address _authorisedUser
    )
        public
        nonReentrant
        onlyRegisteredUser
        onlyRecordOwner(_recordId)
    {
        require(
    !medicalRecords[_recordId].isDeleted,
    "Medical record has been deleted"
);
        require(
            _authorisedUser != address(0),
            "Invalid authorised user"
        );

        require(
            _authorisedUser != msg.sender,
            "Owner already has access"
        );

        require(
            users[_authorisedUser].isRegistered,
            "Authorised user is not registered"
        );

        Role ownerRole = users[msg.sender].role;
        Role recipientRole =
            users[_authorisedUser].role;

        if (ownerRole == Role.Patient) {
            require(
                recipientRole == Role.Doctor ||
                    recipientRole == Role.Researcher,
                "Patients can only share with doctors or researchers"
            );
        } else if (ownerRole == Role.Doctor) {
            require(
                recipientRole == Role.Patient,
                "Doctors can only share records with patients"
            );
        } else {
            revert(
                "This role cannot manage record access"
            );
        }

        require(
            !recordAccess[_recordId][_authorisedUser],
            "Access already granted"
        );

        recordAccess[_recordId][_authorisedUser] =
            true;

        emit AccessGranted(
            _recordId,
            msg.sender,
            _authorisedUser
        );
    }

    function revokeAccess(
        uint256 _recordId,
        address _authorisedUser
    )
        public
        nonReentrant
        onlyRegisteredUser
        onlyRecordOwner(_recordId)
    {
        require(
    !medicalRecords[_recordId].isDeleted,
    "Medical record has been deleted"
);
        require(
            recordAccess[_recordId][_authorisedUser],
            "Access has not been granted"
        );

        recordAccess[_recordId][_authorisedUser] =
            false;

        emit AccessRevoked(
            _recordId,
            msg.sender,
            _authorisedUser
        );
    }
function deleteMedicalRecord(
    uint256 _recordId
)
    public
    nonReentrant
    onlyRegisteredUser
    onlyRecordOwner(_recordId)
{
    require(
        !medicalRecords[_recordId].isDeleted,
        "Medical record already deleted"
    );

    medicalRecords[_recordId].isDeleted = true;

    emit MedicalRecordDeleted(
        _recordId,
        msg.sender,
        block.timestamp
    );
}
    function hasAccess(
        uint256 _recordId,
        address _user
    )
        public
        view
        returns (bool)
    {
        
        require(
            medicalRecords[_recordId].exists,
            "Medical record does not exist"
        );
        require(
    !medicalRecords[_recordId].isDeleted,
    "Medical record has been deleted"
);

        if (
            medicalRecords[_recordId].owner == _user
        ) {
            return true;
        }

        return recordAccess[_recordId][_user];
    }

    function accessMedicalRecord(
        uint256 _recordId
    )
        public
        nonReentrant
        onlyRegisteredUser
        returns (
            uint256,
            address,
            string memory,
            string memory,
            uint256,
            bool
        )
    {
        require(
            medicalRecords[_recordId].exists,
            "Medical record does not exist"
        );

        require(
            !medicalRecords[_recordId].isDeleted,
            "Medical record has been deleted"
        );

        require(
            medicalRecords[_recordId].owner ==
                msg.sender ||
                recordAccess[_recordId][msg.sender],
            "Access denied"
        );

        AccessLog memory newLog = AccessLog({
            recordId: _recordId,
            accessedBy: msg.sender,
            role: users[msg.sender].role,
            accessedAt: block.timestamp
        });

        recordAccessLogs[_recordId].push(newLog);

        emit RecordAccessed(
            _recordId,
            msg.sender,
            users[msg.sender].role,
            block.timestamp
        );

        MedicalRecord memory record =
            medicalRecords[_recordId];

        return (
            record.recordId,
            record.owner,
            record.fileHash,
            record.storageReference,
            record.createdAt,
            record.exists
        );
    }

    function getMedicalRecord(
    uint256 _recordId
)
    public
    view
    onlyRegisteredUser
    returns (
        uint256,
        address,
        string memory,
        string memory,
        uint256,
        bool
    )
{
    require(
        medicalRecords[_recordId].exists,
        "Medical record does not exist"
    );

    require(
        !medicalRecords[_recordId].isDeleted,
        "Medical record has been deleted"
    );

    require(
        medicalRecords[_recordId].owner == msg.sender ||
            recordAccess[_recordId][msg.sender],
        "Access denied"
    );

    MedicalRecord memory record =
        medicalRecords[_recordId];

    return (
        record.recordId,
        record.owner,
        record.fileHash,
        record.storageReference,
        record.createdAt,
        record.exists
    );
}

    function getRecordAccessLogs(
        uint256 _recordId
    )
        public
        view
        onlyRegisteredUser
        onlyRecordOwner(_recordId)
        returns (AccessLog[] memory)
    {
        return recordAccessLogs[_recordId];
    }
    

    function getOwnerRecordIds(
        address _owner
    )
        public
        view
        returns (uint256[] memory)
    {
        return ownerRecordIds[_owner];
    }

    /*
     * Compatibility function for the current Flask backend.
     * It now returns records owned by either a patient or doctor.
     */
    function getPatientRecordIds(
        address _owner
    )
        public
        view
        returns (uint256[] memory)
    {
        return ownerRecordIds[_owner];
    }

    function getUser(
        address _wallet
    )
        public
        view
        returns (
            address,
            string memory,
            Role,
            bool
        )
    {
        User memory user = users[_wallet];

        return (
            user.wallet,
            user.name,
            user.role,
            user.isRegistered
        );
    }

    function isRegistered(
        address _wallet
    )
        public
        view
        returns (bool)
    {
        return users[_wallet].isRegistered;
    }
    function isRecordDeleted(
    uint256 _recordId
)
    public
    view
    returns (bool)
{
    require(
        medicalRecords[_recordId].exists,
        "Medical record does not exist"
    );

    return medicalRecords[_recordId].isDeleted;
}
}
