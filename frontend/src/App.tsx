import "./App.css";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import {
  type BlockchainHealth,
  type BlockchainUser,
  type MedicalRecord,
  type UserProfile,
  checkRecordAccess,
  getBlockchainHealth,
  getMedicalRecord,
  getMedicalRecordDownloadUrl,
  getPatientRecordIds,
  getProfile,
  getUser,
  grantRecordAccess,
  registerUserAutomatically,
  loginWithEmail,
  revokeRecordAccess,
  uploadMedicalRecord,
  deleteMedicalRecord,
  getDoctorSharedRecords,
  getPatientSharedRecords,
  type SharedInboxRecord,
  type AccessLogEntry,
  accessMedicalRecord,
  getRecordAccessLogs,
  getSharedRecordInbox,
} from "./services/api";

const PATIENT_ADDRESS =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const DOCTOR_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const ENABLE_TEST_ACCOUNTS =
  import.meta.env.VITE_ENABLE_TEST_ACCOUNTS === "true";

type ViewName =
  | "dashboard"
  | "records"
  | "access"
  | "audit"
  | "profile"
  | "wallet";

type UserRole = "patient" | "doctor" | "researcher";

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

function formatAddress(address: string) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function App() {
const [authMode, setAuthMode] =
  useState<"login" | "register">("login");
const [profile, setProfile] =
    useState<UserProfile | null>(null);
const [registerName, setRegisterName] =
  useState("");

const [registerRole, setRegisterRole] =
  useState("1");

const [registerEmail, setRegisterEmail] =
  useState("");

const [registerPassword, setRegisterPassword] =
  useState("");

const [registerInstitution, setRegisterInstitution] =
  useState("");

const [registerDepartment, setRegisterDepartment] =
  useState("");

const [registerSpeciality, setRegisterSpeciality] =
  useState("");

const [registerProfessionalId, setRegisterProfessionalId] =
  useState("");

const [assignedWallet, setAssignedWallet] =
  useState("");

const [registerLoading, setRegisterLoading] =
  useState(false);

const [registerError, setRegisterError] =
  useState("");

const [registerSuccess, setRegisterSuccess] =
  useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loginAddress, setLoginAddress] =
    useState(PATIENT_ADDRESS);

  const [loginMethod, setLoginMethod] =
    useState<"wallet" | "email">("wallet");

  const [loginEmail, setLoginEmail] =
    useState("");

  const [loginPassword, setLoginPassword] =
    useState("");

  const [currentAccount, setCurrentAccount] =
    useState("");

  const [currentRole, setCurrentRole] =
    useState<UserRole | null>(null);

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState("");
  
  const [activeView, setActiveView] =
    useState<ViewName>("dashboard");

  const [health, setHealth] =
    useState<BlockchainHealth | null>(null);

  const [patient, setPatient] =
    useState<BlockchainUser | null>(null);

  const [records, setRecords] =
    useState<MedicalRecord[]>([]);
  const [doctorPatientWallet, setDoctorPatientWallet] =
  useState("");

  const [sharedRecords, setSharedRecords] =
    useState<MedicalRecord[]>([]);

  const [sharedRecordsLoading, setSharedRecordsLoading] =
    useState(false);
    const [auditRecordId, setAuditRecordId] =
  useState<number>(0);

  const [auditLogs, setAuditLogs] =
    useState<AccessLogEntry[]>([]);

  const [auditLoading, setAuditLoading] =
    useState(false);

  const [auditError, setAuditError] =
    useState("");

  const [sharedRecordsError, setSharedRecordsError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const [selectedFile, setSelectedFile] =
  useState<File | null>(null);

  const [selectedRecordId, setSelectedRecordId] =
    useState(1);

  const [authorisedAccount, setAuthorisedAccount] =
    useState(DOCTOR_ADDRESS);

  const [doctorHasAccess, setDoctorHasAccess] =
    useState(false);
    const [patientDoctorWallet, setPatientDoctorWallet] =
  useState("");

const [doctorSharedRecords, setDoctorSharedRecords] =
  useState<MedicalRecord[]>([]);
  const [automaticSharedRecords, setAutomaticSharedRecords] =
  useState<SharedInboxRecord[]>([]);

const [
  automaticSharedRecordsLoading,
  setAutomaticSharedRecordsLoading,
] = useState(false);

const [
  automaticSharedRecordsError,
  setAutomaticSharedRecordsError,
] = useState("");

const [
  doctorSharedRecordsLoading,
  setDoctorSharedRecordsLoading,
] = useState(false);

const [
  doctorSharedRecordsError,
  setDoctorSharedRecordsError,
] = useState("");

const loadDashboard = useCallback(async () => {
  if (!currentAccount) {
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError("");

    const blockchainHealth = await getBlockchainHealth();
    const userData = await getUser(currentAccount);

    setHealth(blockchainHealth);
    setPatient(userData);

   if (
  currentRole !== "patient" &&
  currentRole !== "doctor"
) {
  setRecords([]);
  setDoctorHasAccess(false);
  return;
}

    const patientRecordData =
      await getPatientRecordIds(currentAccount);

    const recordResults = await Promise.allSettled(
  patientRecordData.record_ids.map((recordId) =>
    getMedicalRecord(recordId, currentAccount)
  )
);

const loadedRecords = recordResults
  .filter(
    (
      result
    ): result is PromiseFulfilledResult<MedicalRecord> =>
      result.status === "fulfilled"
  )
  .map((result) => result.value);

    setRecords(loadedRecords);

    if (loadedRecords.length > 0) {
  const firstRecordId = loadedRecords[0].record_id;

  setSelectedRecordId(firstRecordId);
  setAuditRecordId((currentValue) =>
    currentValue || firstRecordId
  );
} else {
  setDoctorHasAccess(false);
  setAuditRecordId(0);
  setAuditLogs([]);
}
  } catch (requestError) {
    console.error(requestError);

    setError(
      "Unable to load blockchain data. Make sure Hardhat and Flask are running."
    );
  } finally {
    setLoading(false);
  }
}, [currentAccount, currentRole]);
useEffect(() => {
  if (
    activeView === "audit" &&
    isLoggedIn &&
    currentAccount &&
    auditRecordId
  ) {
    void handleLoadAuditLogs(auditRecordId);
  }
}, [
  activeView,
  isLoggedIn,
  currentAccount,
  auditRecordId,
]);
useEffect(() => {
  async function restoreSession() {
    const savedSession = localStorage.getItem(
      "mediledger_session"
    );

    if (!savedSession) {
      setLoading(false);
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession) as {
        wallet: string;
        role: UserRole;
      };

      const blockchainUser = await getUser(
        parsedSession.wallet
      );

      if (!blockchainUser.is_registered) {
        localStorage.removeItem(
          "mediledger_session"
        );
        setLoading(false);
        return;
      }

      setPatient(blockchainUser);
      setCurrentAccount(blockchainUser.wallet);
      setCurrentRole(parsedSession.role);
      setIsLoggedIn(true);
    } catch (sessionError) {
      console.error(sessionError);

      localStorage.removeItem(
        "mediledger_session"
      );

      setLoading(false);
    }
  }

  restoreSession();
}, []);
useEffect(() => {
  async function refreshAccessStatus() {
    if (
  (currentRole !== "patient" &&
    currentRole !== "doctor") ||
  !selectedRecordId ||
  !authorisedAccount.trim()
) {
      setDoctorHasAccess(false);
      return;
    }

    try {
      const accessStatus = await checkRecordAccess(
        authorisedAccount.trim(),
        selectedRecordId
      );

      setDoctorHasAccess(accessStatus.has_access);
    } catch (requestError) {
      console.error(requestError);
      setDoctorHasAccess(false);
    }
  }

  refreshAccessStatus();
}, [
  currentRole,
  selectedRecordId,
  authorisedAccount,
]);
useEffect(() => {
  if (isLoggedIn && currentAccount) {
    loadDashboard();
  }
}, [
  isLoggedIn,
  currentAccount,
  loadDashboard,
]);
useEffect(() => {
  async function loadProfile() {
    if (!isLoggedIn || !currentAccount) {
      setProfile(null);
      return;
    }

    try {
      const profileData = await getProfile(currentAccount);
      setProfile(profileData);
    } catch (requestError) {
      console.error(requestError);
      setProfile(null);
    }
  }

  loadProfile();
}, [isLoggedIn, currentAccount]);
async function completeLoginWithAddress(
  address: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const blockchainUser = await getUser(address);

  if (!blockchainUser.is_registered) {
    return {
      ok: false,
      message: "This wallet is not registered on the blockchain.",
    };
  }

  let detectedRole: UserRole;

  if (blockchainUser.role === 1) {
    detectedRole = "patient";
  } else if (blockchainUser.role === 2) {
    detectedRole = "doctor";
  } else if (blockchainUser.role === 3) {
    detectedRole = "researcher";
  } else {
    return {
      ok: false,
      message: "The blockchain role is invalid.",
    };
  }

  setPatient(blockchainUser);
  setCurrentAccount(blockchainUser.wallet);
  setCurrentRole(detectedRole);
  setIsLoggedIn(true);
  setActiveView("dashboard");

  localStorage.setItem(
    "mediledger_session",
    JSON.stringify({
      wallet: blockchainUser.wallet,
      role: detectedRole,
    })
  );

  return { ok: true };
}

async function handleLogin(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const enteredAddress = loginAddress.trim();

  if (!enteredAddress) {
    setLoginError("Please enter a wallet address.");
    return;
  }

  try {
    setLoginLoading(true);
    setLoginError("");

    const result = await completeLoginWithAddress(
      enteredAddress
    );

    if (!result.ok) {
      setLoginError(result.message);
    }
  } catch (requestError) {
    console.error(requestError);

    setLoginError(
      "Login failed. Make sure Flask and Hardhat are running."
    );
  } finally {
    setLoginLoading(false);
  }
}

async function handleEmailLogin(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const enteredEmail = loginEmail.trim();
  const enteredPassword = loginPassword;

  if (!enteredEmail || !enteredPassword) {
    setLoginError("Please enter your email and password.");
    return;
  }

  try {
    setLoginLoading(true);
    setLoginError("");

    const { wallet_address } = await loginWithEmail(
      enteredEmail,
      enteredPassword
    );

    const result = await completeLoginWithAddress(
      wallet_address
    );

    if (!result.ok) {
      setLoginError(result.message);
    }
  } catch (requestError) {
    console.error(requestError);

    setLoginError(
      "Login failed. Check your email and password and try again."
    );
  } finally {
    setLoginLoading(false);
  }
}
async function handleRegister(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const name = registerName.trim();
  const role = Number(registerRole);

  if (!name) {
    setRegisterError("Please enter your full name.");
    return;
  }

  if (![1, 2, 3].includes(role)) {
    setRegisterError("Please select a valid role.");
    return;
  }

  if (role === 2 && !registerInstitution.trim()) {
    setRegisterError(
      "Doctors must provide their hospital or institution."
    );
    return;
  }

  if (registerEmail.trim() && !registerPassword.trim()) {
    setRegisterError(
      "Please set a password so you can log in with your email later."
    );
    return;
  }

  try {
    setRegisterLoading(true);
    setRegisterError("");
    setRegisterSuccess("");
    setAssignedWallet("");

    const result = await registerUserAutomatically({
      full_name: name,
      role,
      email: registerEmail.trim() || undefined,
      password: registerPassword.trim() || undefined,
      institution:
        registerInstitution.trim() || undefined,
      department:
        registerDepartment.trim() || undefined,
      speciality:
        registerSpeciality.trim() || undefined,
      professional_id:
        registerProfessionalId.trim() || undefined,
    });

    setAssignedWallet(result.assigned_wallet);

    setRegisterSuccess(
      "Registration completed successfully. Your wallet was assigned automatically."
    );

    setLoginAddress(result.assigned_wallet);

    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterInstitution("");
    setRegisterDepartment("");
    setRegisterSpeciality("");
    setRegisterProfessionalId("");
  } catch (requestError) {
    console.error(requestError);

    setRegisterError(
      "Registration failed. No unused local blockchain account may be available, or the backend is unavailable."
    );
  } finally {
    setRegisterLoading(false);
  }
}
  async function handleUpload(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (!selectedFile) {
    setNotice({
      type: "error",
      message: "Please choose a medical file.",
    });

    return;
  }

  try {
    setActionLoading(true);
    setNotice(null);

    await uploadMedicalRecord(
  currentAccount,
  selectedFile
);

    setNotice({
      type: "success",
      message:
        "Medical record uploaded and encrypted successfully.",
    });

    setSelectedFile(null);
    setUploadOpen(false);

    await loadDashboard();
    if (currentRole === "doctor") {
  setNotice({
    type: "success",
    message:
      "Doctor report uploaded successfully. You can now grant a patient access.",
  });
}
    if (currentRole === "patient") {
  setActiveView("records");
}
  } catch (requestError) {
    console.error(requestError);

    setNotice({
      type: "error",
      message: "The file could not be uploaded.",
    });
  } finally {
    setActionLoading(false);
  }
}

  async function handleGrantAccess() {
    try {
      setActionLoading(true);
      setNotice(null);

      await grantRecordAccess(
  currentAccount,
  authorisedAccount.trim(),
  selectedRecordId
);

      setDoctorHasAccess(true);

      setNotice({
        type: "success",
        message: "Access granted successfully.",
      });

      setAccessOpen(false);
      await loadDashboard();
      await loadAutomaticSharedRecords();
    } catch (requestError) {
      console.error(requestError);

      setNotice({
        type: "error",
        message:
          "Access could not be granted. It may already be active.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeAccess() {
    try {
      setActionLoading(true);
      setNotice(null);

      await revokeRecordAccess(
  currentAccount,
  authorisedAccount.trim(),
  selectedRecordId
);

      setDoctorHasAccess(false);

      setNotice({
        type: "success",
        message: "Access revoked successfully.",
      });

      await loadDashboard();
      await loadAutomaticSharedRecords();
    } catch (requestError) {
      console.error(requestError);

      setNotice({
        type: "error",
        message:
          "Access could not be revoked. The user may not currently have access.",
      });
    } finally {
      setActionLoading(false);
    }
  }
  async function handleDeleteRecord(
    recordId: number
) {
    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this medical record?"
    );

    if (!confirmed) {
        return;
    }

    try {
        setActionLoading(true);

        await deleteMedicalRecord(
            currentAccount,
            recordId
        );

        await loadDashboard();

        setNotice({
            type: "success",
            message:
                "Medical record deleted successfully.",
        });
    } catch (error) {
        console.error(error);

        setNotice({
            type: "error",
            message:
                "Unable to delete the medical record.",
        });
    } finally {
        setActionLoading(false);
    }
}
async function handleLoadSharedRecords() {
  const patientWallet = doctorPatientWallet.trim();

  if (!patientWallet) {
    setSharedRecordsError(
      "Please enter the patient's wallet address."
    );
    return;
  }

  try {
    setSharedRecordsLoading(true);
    setSharedRecordsError("");

    const result = await getDoctorSharedRecords(
      currentAccount,
      patientWallet
    );

    setSharedRecords(result.records);
  } catch (requestError) {
    console.error(requestError);

    setSharedRecords([]);
    setSharedRecordsError(
      "Unable to load shared records. Confirm that the patient granted access to this doctor."
    );
  } finally {
    setSharedRecordsLoading(false);
  }
}
async function handleAccessAndDownload(
  recordId: number
) {
  if (!currentAccount) {
    setNotice({
      type: "error",
      message: "No wallet is currently logged in.",
    });
    return;
  }

  try {
    setActionLoading(true);
    setNotice(null);

    await accessMedicalRecord(
      currentAccount,
      recordId
    );

    const downloadUrl =
      getMedicalRecordDownloadUrl(
        recordId,
        currentAccount
      );

    window.open(
      downloadUrl,
      "_blank",
      "noopener,noreferrer"
    );

    setNotice({
      type: "success",
      message:
        "Record access was written to the blockchain audit log.",
    });
  } catch (requestError) {
    console.error(requestError);

    setNotice({
      type: "error",
      message:
        "The record could not be accessed. Confirm that permission is active.",
    });
  } finally {
    setActionLoading(false);
  }
}
function renderUploadModal() {
  if (!uploadOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">
              NEW BLOCKCHAIN RECORD
            </p>

            <h3>
              {currentRole === "doctor"
                ? "Upload Medical Report"
                : "Upload Medical Record"}
            </h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={() => {
              setUploadOpen(false);
              setSelectedFile(null);
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpload}>
          <div className="form-field">
            <label htmlFor="medical-file">
              Medical document
            </label>

            <input
              id="medical-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
              onChange={(event) =>
                setSelectedFile(
                  event.target.files?.[0] ?? null
                )
              }
            />

            <small>
              Supported formats: PDF, PNG, JPG,
              Word and TXT.
            </small>
          </div>

          {selectedFile && (
            <div className="selected-file-card">
              <div>
                <strong>{selectedFile.name}</strong>

                <p>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>

              <button
                type="button"
                className="remove-file-button"
                onClick={() => setSelectedFile(null)}
              >
                Remove
              </button>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setUploadOpen(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="page-action-button"
              disabled={actionLoading}
            >
              {actionLoading
                ? "Uploading..."
                : "Upload and Encrypt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
const loadAutomaticSharedRecords =
  useCallback(async () => {
    if (!currentAccount || !isLoggedIn) {
      setAutomaticSharedRecords([]);
      return;
    }

    try {
      setAutomaticSharedRecordsLoading(true);
      setAutomaticSharedRecordsError("");

      const result = await getSharedRecordInbox(
        currentAccount
      );

      setAutomaticSharedRecords(result.records);
    } catch (requestError) {
      console.error(requestError);

      setAutomaticSharedRecords([]);

      setAutomaticSharedRecordsError(
        "Unable to load records shared with this account."
      );
    } finally {
      setAutomaticSharedRecordsLoading(false);
    }
  }, [currentAccount, isLoggedIn]);
  useEffect(() => {
  if (!isLoggedIn || !currentAccount) {
    setAutomaticSharedRecords([]);
    return;
  }

  loadAutomaticSharedRecords();

  const intervalId = window.setInterval(() => {
    loadAutomaticSharedRecords();
  }, 10000);

  return () => {
    window.clearInterval(intervalId);
  };
}, [
  isLoggedIn,
  currentAccount,
  loadAutomaticSharedRecords,
]);
function renderAutomaticSharedRecords() {
  return (
    <article className="panel automatic-inbox-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            AUTOMATIC SHARED RECORDS
          </p>

          <h3>Records Shared With Me</h3>

          <p className="panel-description">
            Records appear here automatically when another
            registered user grants your account access.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadAutomaticSharedRecords}
          disabled={automaticSharedRecordsLoading}
          title="Refresh shared records"
        >
          <RefreshCw
            size={18}
            className={
              automaticSharedRecordsLoading
                ? "loading-icon"
                : ""
            }
          />
        </button>
      </div>

      {automaticSharedRecordsLoading &&
        automaticSharedRecords.length === 0 && (
          <div className="system-message">
            <LoaderCircle
              className="loading-icon"
              size={20}
            />

            <span>Loading shared records...</span>
          </div>
        )}

      {automaticSharedRecordsError && (
        <div className="system-message error-message">
          <AlertCircle size={20} />
          <span>{automaticSharedRecordsError}</span>
        </div>
      )}

      {!automaticSharedRecordsLoading &&
        !automaticSharedRecordsError &&
        automaticSharedRecords.length === 0 && (
          <div className="empty-state">
            <FileText size={34} />

            <h4>No records shared with you</h4>

            <p>
              When a patient, doctor, or authorised user
              grants access, the record and owner details
              will appear here automatically.
            </p>
          </div>
        )}

      {automaticSharedRecords.length > 0 && (
        <div className="automatic-shared-list">
          {automaticSharedRecords.map((record) => (
            <div
              className="automatic-shared-card"
              key={`${record.owner_wallet}-${record.record_id}`}
            >
              <div className="shared-owner-header">
                <div className="shared-owner-avatar">
                  {record.owner_profile.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <span className="verified-badge">
                    Access Granted
                  </span>

                  <h4>
                    {record.owner_profile.full_name}
                  </h4>

                  <p>
                    {record.owner_profile.role === 2
                      ? "Doctor"
                      : record.owner_profile.role === 1
                        ? "Patient"
                        : "Researcher"}
                  </p>
                </div>
              </div>

              <div className="shared-profile-details">
                {record.owner_profile.institution && (
                  <div>
                    <span>Hospital or institution</span>
                    <strong>
                      {record.owner_profile.institution}
                    </strong>
                  </div>
                )}

                {record.owner_profile.department && (
                  <div>
                    <span>Department</span>
                    <strong>
                      {record.owner_profile.department}
                    </strong>
                  </div>
                )}

                {record.owner_profile.speciality && (
                  <div>
                    <span>Speciality</span>
                    <strong>
                      {record.owner_profile.speciality}
                    </strong>
                  </div>
                )}

                {record.owner_profile.email && (
                  <div>
                    <span>Email</span>
                    <strong>
                      {record.owner_profile.email}
                    </strong>
                  </div>
                )}

                <div>
                  <span>Wallet</span>
                  <strong>
                    {formatAddress(record.owner_wallet)}
                  </strong>
                </div>
              </div>

              <div className="shared-record-information">
                <div className="record-icon">
                  <FileText size={22} />
                </div>

                <div>
                  <strong>
                    {record.owner_profile.role === 2
                      ? "Doctor Report"
                      : "Patient Medical Record"}{" "}
                    #{record.record_id}
                  </strong>

                  <p>{record.storage_reference}</p>

                  <small>
                    Shared record created{" "}
                    {formatDate(record.created_at)}
                  </small>
                </div>
              </div>

              <div className="shared-record-footer">
                <p>
                  Hash:{" "}
                  {record.file_hash.slice(0, 20)}...
                </p>

                <div className="record-actions">
                  <button
  type="button"
  className="download-record-button"
  onClick={() =>
    void handleAccessAndDownload(
      record.record_id
    )
  }
  disabled={actionLoading}
>
  {actionLoading
    ? "Opening..."
    : "Open and Download"}
</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
async function handleLoadAuditLogs(
  requestedRecordId?: number
) {
  const recordId =
    requestedRecordId ?? auditRecordId;

  if (!recordId) {
    setAuditError(
      "Select a medical record before loading audit logs."
    );
    setAuditLogs([]);
    return;
  }

  if (!currentAccount) {
    setAuditError(
      "No blockchain wallet is currently logged in."
    );
    setAuditLogs([]);
    return;
  }

  try {
    setAuditLoading(true);
    setAuditError("");

    const result = await getRecordAccessLogs(
      recordId,
      currentAccount
    );

    setAuditLogs(result.logs);
  } catch (requestError) {
    console.error(requestError);

    setAuditLogs([]);
    setAuditError(
      "Unable to load audit logs. Only the record owner can view its audit history."
    );
  } finally {
    setAuditLoading(false);
  }
}
  function renderDashboard() {
    return (
      <>
        <section className="hero-card">
          <div>
            <span className="hero-label">
              Patient-Controlled Data Sharing
            </span>

            <h3>
              Welcome, {patient?.name ?? "Patient"}.
              <br />
              Your records are protected.
            </h3>

            <p>
              Upload healthcare records, manage provider
              permissions and monitor blockchain access events
              from one secure dashboard.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => setUploadOpen(true)}
              >
                <FilePlus2 size={18} />
                Upload Medical Record
              </button>

              <button
                className="secondary-button"
                onClick={() => {
                  setActiveView("access");
                  setAccessOpen(true);
                }}
              >
                Manage Access
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="security-ring outer-ring">
              <div className="security-ring middle-ring">
                <div className="security-core">
                  <ShieldCheck size={48} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="statistics-grid">
          <article className="stat-card">
            <div className="stat-icon blue-icon">
              <FileText size={22} />
            </div>

            <div>
              <p>Total Records</p>
              <h4>{records.length}</h4>
              <span>Stored securely</span>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon green-icon">
              <UsersRound size={22} />
            </div>

            <div>
              <p>Doctor Permission</p>
              <h4>
                {doctorHasAccess ? "Active" : "Revoked"}
              </h4>
              <span>Patient-controlled</span>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon purple-icon">
              <Activity size={22} />
            </div>

            <div>
              <p>Latest Block</p>
              <h4>{health?.latest_block ?? "-"}</h4>
              <span>Local blockchain</span>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon orange-icon">
              <ShieldCheck size={22} />
            </div>

            <div>
              <p>Security Status</p>

              <h4 className="secure-text">
                {health?.blockchain_connected
                  ? "Secure"
                  : "Offline"}
              </h4>

              <span>
                {health?.blockchain_connected
                  ? "All systems operational"
                  : "Connection unavailable"}
              </span>
            </div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LIVE BLOCKCHAIN DATA</p>
                <h3>Recent Medical Records</h3>
              </div>

              <button
                className="text-button"
                onClick={() => setActiveView("records")}
              >
                View all
              </button>
            </div>

            {renderRecords(records.slice(0, 3))}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SYSTEM INFORMATION</p>
                <h3>Blockchain Status</h3>
              </div>
            </div>

            <div className="information-list">
              <div className="information-row">
                <span>Network</span>
                <strong>Hardhat Localhost</strong>
              </div>

              <div className="information-row">
                <span>Connection</span>
                <strong>
                  {health?.blockchain_connected
                    ? "Connected"
                    : "Disconnected"}
                </strong>
              </div>

              <div className="information-row">
                <span>Latest block</span>
                <strong>{health?.latest_block ?? "-"}</strong>
              </div>

              <div className="information-row">
                <span>Contract</span>
                <strong>
                  {health?.contract_address
                    ? formatAddress(
                        health.contract_address
                      )
                    : "-"}
                </strong>
              </div>
            </div>
          </article>
        </section>
        {renderUploadModal()}
      </>
    );
  }
async function handleLoadDoctorSharedRecords() {
  const doctorWallet = patientDoctorWallet.trim();

  if (!doctorWallet) {
    setDoctorSharedRecordsError(
      "Please enter the doctor's wallet address."
    );
    return;
  }

  try {
    setDoctorSharedRecordsLoading(true);
    setDoctorSharedRecordsError("");

    const result = await getPatientSharedRecords(
      currentAccount,
      doctorWallet
    );

    setDoctorSharedRecords(result.records);
  } catch (requestError) {
    console.error(requestError);

    setDoctorSharedRecords([]);
    setDoctorSharedRecordsError(
      "Unable to load reports shared by this doctor."
    );
  } finally {
    setDoctorSharedRecordsLoading(false);
  }
}
  function renderRecords(recordsToDisplay: MedicalRecord[]) {
    if (recordsToDisplay.length === 0 && !loading) {
      return (
        <div className="empty-state">
          <FileText size={32} />
          <h4>No medical records found</h4>
          <p>
            Upload a healthcare record to create your first
            blockchain entry.
          </p>
        </div>
      );
    }

    return (
      <div className="records-list">
        {recordsToDisplay.map((record) => (
          <div
            className="record-item"
            key={record.record_id}
          >
            <div className="record-icon">
              <FileText size={22} />
            </div>

            <div className="record-information">
              <strong>
                Medical Record #{record.record_id}
              </strong>

              <p>{record.storage_reference}</p>

              <small>
                Created {formatDate(record.created_at)}
              </small>
            </div>

            <div className="record-meta">
  <span className="verified-badge">
    Verified
  </span>

  <p>
    Hash: {record.file_hash.slice(0, 16)}...
  </p>

 <div className="record-actions">

    <a
        href={getMedicalRecordDownloadUrl(
            record.record_id,
            currentAccount
        )}
        className="download-record-button"
    >
        Download
    </a>

    {record.patient === currentAccount && (
        <button
            type="button"
            className="delete-record-button"
            onClick={() =>
                handleDeleteRecord(record.record_id)
            }
        >
            Delete
        </button>
    )}

</div>
</div>
          </div>
        ))}
      </div>
    );
  }

  function renderRecordsPage() {
    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <p className="eyebrow">PATIENT RECORDS</p>
            <h3>Medical Records</h3>
            <p>
              Records registered and verified on the blockchain.
            </p>
          </div>

          <button
            className="page-action-button"
            onClick={() => setUploadOpen(true)}
          >
            <FilePlus2 size={18} />
            Add Record
          </button>
        </div>

        <article className="panel">
  <div className="panel-heading">
    <div>
      <p className="eyebrow">MY RECORDS</p>
      <h3>Records Uploaded by Me</h3>
    </div>
  </div>

  {renderRecords(records)}
</article>
{renderAutomaticSharedRecords()}
<article className="panel">
  <div className="panel-heading">
    <div>
      <p className="eyebrow">DOCTOR SHARED REPORTS</p>
      <h3>Reports Shared by Doctors</h3>
    </div>
  </div>

  <div className="form-field">
    <label htmlFor="patient-doctor-wallet">
      Doctor wallet address
    </label>

    <input
      id="patient-doctor-wallet"
      value={patientDoctorWallet}
      onChange={(event) =>
        setPatientDoctorWallet(event.target.value)
      }
      placeholder="Enter the doctor's blockchain wallet"
    />
  </div>

  <button
    type="button"
    className="page-action-button"
    onClick={handleLoadDoctorSharedRecords}
    disabled={doctorSharedRecordsLoading}
  >
    {doctorSharedRecordsLoading
      ? "Loading reports..."
      : "Load Doctor Reports"}
  </button>

  {doctorSharedRecordsError && (
    <div className="system-message error-message">
      <AlertCircle size={20} />
      <span>{doctorSharedRecordsError}</span>
    </div>
  )}

  {doctorSharedRecords.length === 0 &&
    !doctorSharedRecordsLoading &&
    !doctorSharedRecordsError && (
      <div className="empty-state">
        <FileText size={34} />
        <h4>No doctor reports loaded</h4>
        <p>
          Enter a doctor wallet address to load reports shared
          with your patient account.
        </p>
      </div>
    )}

  {doctorSharedRecords.length > 0 && (
    <div className="records-list">
      {doctorSharedRecords.map((record) => (
        <div
          className="record-item"
          key={record.record_id}
        >
          <div className="record-icon">
            <FileText size={22} />
          </div>

          <div className="record-information">
            <strong>
              Doctor Report #{record.record_id}
            </strong>

            <p>{record.storage_reference}</p>

            <small>
              Created {formatDate(record.created_at)}
            </small>
          </div>

          <div className="record-meta">
            <span className="verified-badge">
              Shared by Doctor
            </span>

            <p>
              Hash: {record.file_hash.slice(0, 16)}...
            </p>

            <button
  type="button"
  className="text-button"
  onClick={() =>
    void handleAccessAndDownload(
      record.record_id
    )
  }
  disabled={actionLoading}
>
  Open and Download
</button>
          </div>
        </div>
      ))}
    </div>
  )}
</article>
      </section>
    );
  }

  function renderAccessPage() {
    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <p className="eyebrow">PATIENT CONSENT</p>
            <h3>Access Management</h3>
            <p>
              Grant or revoke healthcare-provider access to your
              records.
            </p>
          </div>
        </div>

        <article className="panel access-panel">
          <div className="form-field">
            <label htmlFor="record-selection">
              Medical record
            </label>

            <select
              id="record-selection"
              value={selectedRecordId}
              onChange={(event) =>
                setSelectedRecordId(
                  Number(event.target.value)
                )
              }
            >
              {records.map((record) => (
                <option
                  key={record.record_id}
                  value={record.record_id}
                >
                  Medical Record #{record.record_id}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="authorised-account">
              Healthcare-provider wallet
            </label>

            <input
              id="authorised-account"
              value={authorisedAccount}
              onChange={(event) =>
                setAuthorisedAccount(event.target.value)
              }
            />
          </div>

          <div className="permission-status">
            <span
              className={
                doctorHasAccess
                  ? "permission-dot active-permission"
                  : "permission-dot"
              }
            />

            <div>
              <strong>
                {doctorHasAccess
                  ? "Access is currently active"
                  : "Access is currently revoked"}
              </strong>

              <p>
                Record #{selectedRecordId} ·{" "}
                {formatAddress(authorisedAccount)}
              </p>
            </div>
          </div>

          <div className="permission-actions">
            <button
              className="page-action-button"
              onClick={handleGrantAccess}
              disabled={
                actionLoading || doctorHasAccess
              }
            >
              Grant Access
            </button>

            <button
              className="danger-button"
              onClick={handleRevokeAccess}
              disabled={
                actionLoading || !doctorHasAccess
              }
            >
              Revoke Access
            </button>
          </div>
        </article>
      </section>
    );
  }
  function renderAuditPage() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            IMMUTABLE BLOCKCHAIN HISTORY
          </p>

          <h3>Audit Logs</h3>

          <p>
            Review blockchain-recorded access activity for
            medical records that you own.
          </p>
        </div>

        <button
          type="button"
          className="page-action-button"
          onClick={() => handleLoadAuditLogs()}
          disabled={
            auditLoading ||
            records.length === 0 ||
            !auditRecordId
          }
        >
          <RefreshCw
            size={18}
            className={
              auditLoading ? "loading-icon" : ""
            }
          />

          {auditLoading
            ? "Loading..."
            : "Refresh Logs"}
        </button>
      </div>

      <article className="panel audit-panel">
        {records.length === 0 ? (
          <div className="empty-state">
            <Activity size={34} />

            <h4>No owned records available</h4>

            <p>
              Upload a medical record before viewing its
              audit history.
            </p>
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="audit-record-selection">
                Select owned medical record
              </label>

              <select
                id="audit-record-selection"
                value={auditRecordId}
                onChange={(event) => {
                  const recordId = Number(
                    event.target.value
                  );

                  setAuditRecordId(recordId);
                  setAuditLogs([]);
                  setAuditError("");

                  void handleLoadAuditLogs(recordId);
                }}
              >
                <option value={0}>
                  Select a record
                </option>

                {records.map((record) => (
                  <option
                    key={record.record_id}
                    value={record.record_id}
                  >
                    Medical Record #{record.record_id}
                  </option>
                ))}
              </select>
            </div>

            {auditError && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{auditError}</span>
              </div>
            )}

            {auditLoading ? (
              <div className="empty-state">
                <LoaderCircle
                  className="loading-icon"
                  size={34}
                />

                <h4>Loading blockchain audit logs</h4>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <ShieldCheck size={34} />

                <h4>No access events recorded</h4>

                <p>
                  An entry appears after an authorised user
                  opens the record through the access
                  transaction.
                </p>
              </div>
            ) : (
              <div className="audit-list">
                {auditLogs.map((log, index) => (
                  <div
                    className="audit-item"
                    key={`${log.record_id}-${log.accessed_at}-${index}`}
                  >
                    <div className="audit-icon">
                      <Activity size={20} />
                    </div>

                    <div className="audit-information">
                      <strong>
                        {log.accessor_profile?.full_name ??
                          "Registered blockchain user"}
                      </strong>

                      <p>
                        Accessed Medical Record #
                        {log.record_id}
                      </p>

                      <small>
                        {formatDate(log.accessed_at)}
                      </small>
                    </div>

                    <div className="audit-meta">
                      <span className="verified-badge">
                        {log.role === 1
                          ? "Patient"
                          : log.role === 2
                            ? "Doctor"
                            : log.role === 3
                              ? "Researcher"
                              : "Unknown"}
                      </span>

                      <p>
                        {formatAddress(log.accessed_by)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </article>
    </section>
  );
}

  function renderSimplePage(
    heading: string,
    description: string
  ) {
    return (
      <section className="page-section">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MEDILEDGER</p>
            <h3>{heading}</h3>
            <p>{description}</p>
          </div>
        </div>

        <article className="panel empty-feature">
          <ShieldCheck size={42} />
          <h4>{heading}</h4>
          <p>
            This section is connected to the application
            navigation and will be expanded in the next build
            phase.
          </p>
        </article>
      </section>
    );
  }

  function renderCurrentView() {
    switch (activeView) {
      case "records":
        return renderRecordsPage();

      case "access":
        return renderAccessPage();
      case "audit":
        return renderAuditPage();

      case "profile":
        return renderSimplePage(
          "Patient Profile",
          "View blockchain-verified patient information."
        );

      case "wallet":
        return renderSimplePage(
          "Wallet Information",
          "Review the active blockchain wallet and contract network."
        );

      default:
        return renderDashboard();
    }
  }
if (!isLoggedIn) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">
            <ShieldCheck size={28} />
          </div>

          <div>
            <h1>MediLedger</h1>
            <p>Patient-Controlled Healthcare Data Sharing</p>
          </div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">BLOCKCHAIN LOGIN</p>
          <h2>Access your secure portal</h2>
          <p>
            Enter a registered blockchain wallet address.
            Your role will be detected automatically.
          </p>
        </div>

        <div className="auth-tabs">
  <button
    type="button"
    className={
      authMode === "login"
        ? "auth-tab active-auth-tab"
        : "auth-tab"
    }
    onClick={() => {
      setAuthMode("login");
      setLoginError("");
      setRegisterError("");
    }}
  >
    Login
  </button>

  <button
    type="button"
    className={
      authMode === "register"
        ? "auth-tab active-auth-tab"
        : "auth-tab"
    }
    onClick={() => {
      setAuthMode("register");
      setLoginError("");
      setRegisterError("");
      setRegisterSuccess("");
    }}
  >
    Register
  </button>
</div>

{authMode === "login" ? (
  <form
    onSubmit={
      loginMethod === "wallet"
        ? handleLogin
        : handleEmailLogin
    }
  >
    <div className="auth-tabs">
      <button
        type="button"
        className={
          loginMethod === "wallet"
            ? "auth-tab active-auth-tab"
            : "auth-tab"
        }
        onClick={() => {
          setLoginMethod("wallet");
          setLoginError("");
        }}
      >
        Wallet address
      </button>

      <button
        type="button"
        className={
          loginMethod === "email"
            ? "auth-tab active-auth-tab"
            : "auth-tab"
        }
        onClick={() => {
          setLoginMethod("email");
          setLoginError("");
        }}
      >
        Email &amp; password
      </button>
    </div>

    {loginMethod === "wallet" ? (
      <div className="form-field">
        <label htmlFor="login-wallet">
          Wallet address
        </label>

        <input
          id="login-wallet"
          value={loginAddress}
          onChange={(event) =>
            setLoginAddress(event.target.value)
          }
          placeholder="0x..."
        />
      </div>
    ) : (
      <>
        <div className="form-field">
          <label htmlFor="login-email">
            Email address
          </label>

          <input
            id="login-email"
            type="email"
            value={loginEmail}
            onChange={(event) =>
              setLoginEmail(event.target.value)
            }
            placeholder="name@example.com"
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            value={loginPassword}
            onChange={(event) =>
              setLoginPassword(event.target.value)
            }
            placeholder="Your password"
          />
        </div>
      </>
    )}

    {registerSuccess && (
      <div className="login-success">
        <CheckCircle2 size={18} />
        <span>{registerSuccess}</span>
      </div>
    )}

    {loginError && (
      <div className="login-error">
        <AlertCircle size={18} />
        <span>{loginError}</span>
      </div>
    )}

    <button
      type="submit"
      className="login-button"
      disabled={loginLoading}
    >
      {loginLoading ? (
        <>
          <LoaderCircle
            className="loading-icon"
            size={19}
          />
          Checking blockchain...
        </>
      ) : (
        <>
          <Wallet size={19} />
          Login with Wallet
        </>
      )}
    </button>

    {ENABLE_TEST_ACCOUNTS && (
  <div className="login-test-accounts">
    <p>Local test accounts</p>

    <button
      type="button"
      onClick={() =>
        setLoginAddress(PATIENT_ADDRESS)
      }
    >
      Patient
    </button>

    <button
      type="button"
      onClick={() =>
        setLoginAddress(DOCTOR_ADDRESS)
      }
    >
      Doctor
    </button>
  </div>
)}
  </form>
) : (
  <form onSubmit={handleRegister}>
    <div className="form-field">
      <label htmlFor="register-name">
        Full name
      </label>

      <input
        id="register-name"
        value={registerName}
        onChange={(event) =>
          setRegisterName(event.target.value)
        }
        placeholder="Example: Dr. Sarah Ahmed"
      />
    </div>

    <div className="form-field">
      <label htmlFor="register-role">
        User role
      </label>

      <select
        id="register-role"
        value={registerRole}
        onChange={(event) =>
          setRegisterRole(event.target.value)
        }
      >
        <option value="1">Patient</option>
        <option value="2">Doctor</option>
        <option value="3">Researcher</option>
      </select>
    </div>

    {assignedWallet && (
  <div className="login-success">
    <CheckCircle2 size={18} />

    <div>
      <strong>Wallet assigned successfully</strong>
      <p>{assignedWallet}</p>
    </div>
  </div>
)}

    <div className="form-field">
  <label htmlFor="register-email">
    Email address
  </label>

  <input
    id="register-email"
    type="email"
    value={registerEmail}
    onChange={(event) =>
      setRegisterEmail(event.target.value)
    }
    placeholder="name@example.com"
  />
</div>

<div className="form-field">
  <label htmlFor="register-password">
    Password (needed to log in with your email)
  </label>

  <input
    id="register-password"
    type="password"
    value={registerPassword}
    onChange={(event) =>
      setRegisterPassword(event.target.value)
    }
    placeholder="Choose a password"
  />
</div>

<div className="form-field">
  <label htmlFor="register-institution">
    Hospital or institution
  </label>

  <input
    id="register-institution"
    value={registerInstitution}
    onChange={(event) =>
      setRegisterInstitution(event.target.value)
    }
    placeholder="Example: City General Hospital"
  />
</div>

<div className="form-field">
  <label htmlFor="register-department">
    Department
  </label>

  <input
    id="register-department"
    value={registerDepartment}
    onChange={(event) =>
      setRegisterDepartment(event.target.value)
    }
    placeholder="Example: Cardiology"
  />
</div>

<div className="form-field">
  <label htmlFor="register-speciality">
    Speciality
  </label>

  <input
    id="register-speciality"
    value={registerSpeciality}
    onChange={(event) =>
      setRegisterSpeciality(event.target.value)
    }
    placeholder="Example: Cardiologist"
  />
</div>

<div className="form-field">
  <label htmlFor="register-professional-id">
    Professional or institutional ID
  </label>

  <input
    id="register-professional-id"
    value={registerProfessionalId}
    onChange={(event) =>
      setRegisterProfessionalId(event.target.value)
    }
    placeholder="Example: GMC-123456"
  />
</div>

    {registerError && (
      <div className="login-error">
        <AlertCircle size={18} />
        <span>{registerError}</span>
      </div>
    )}

    <button
      type="submit"
      className="login-button"
      disabled={registerLoading}
    >
      {registerLoading ? (
        <>
          <LoaderCircle
            className="loading-icon"
            size={19}
          />
          Registering on blockchain...
        </>
      ) : (
        <>
          <UserRound size={19} />
          Register Account
        </>
      )}
    </button>
  </form>
)}

        
      </div>
    </div>
  );
}
if (currentRole === "doctor") {
  return (
    <div className="role-portal">
      <header className="role-portal-header">
        <div>
          <p className="eyebrow">DOCTOR PORTAL</p>
          <h1>Welcome, {profile?.full_name ?? patient?.name ?? "Doctor"}</h1>
          <p>
            Review your professional profile and access shared
            patient records.
          </p>
        </div>

        <button
          className="logout-button"
          onClick={() => {
            localStorage.removeItem("mediledger_session");
            setIsLoggedIn(false);
            setCurrentAccount("");
            setCurrentRole(null);
            setPatient(null);
            setProfile(null);
            setRecords([]);
          }}
        >
          Logout
        </button>
      </header>

      <section className="doctor-profile-grid">
        <article className="panel doctor-profile-card">
          <div className="doctor-profile-heading">
            <div className="doctor-avatar">
              {(profile?.full_name ?? patient?.name ?? "Doctor")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div>
              <p className="eyebrow">BLOCKCHAIN VERIFIED</p>
              <h2>{profile?.full_name ?? patient?.name ?? "Doctor"}</h2>
              <p>{profile?.speciality ?? "Healthcare professional"}</p>
            </div>
          </div>

          <div className="information-list">
            <div className="information-row">
              <span>Hospital</span>
              <strong>{profile?.institution ?? "Not provided"}</strong>
            </div>

            <div className="information-row">
              <span>Department</span>
              <strong>{profile?.department ?? "Not provided"}</strong>
            </div>

            <div className="information-row">
              <span>Speciality</span>
              <strong>{profile?.speciality ?? "Not provided"}</strong>
            </div>

            <div className="information-row">
              <span>Professional ID</span>
              <strong>{profile?.professional_id ?? "Not provided"}</strong>
            </div>

            <div className="information-row">
              <span>Email</span>
              <strong>{profile?.email ?? "Not provided"}</strong>
            </div>

            <div className="information-row">
              <span>Wallet</span>
              <strong>{formatAddress(currentAccount)}</strong>
            </div>
          </div>
        </article>

        <article className="panel doctor-action-card">
          <p className="eyebrow">PATIENT RECORD ACCESS</p>
          <h2>Shared medical records</h2>
          <button
  className="page-action-button"
  onClick={() => setUploadOpen(true)}
>
  <FilePlus2 size={18} />
  Upload Medical Report
</button>
<div className="doctor-owned-records">
  <p className="eyebrow">
    MY UPLOADED REPORTS
  </p>

  {records.length === 0 ? (
    <div className="empty-state">
      <FileText size={32} />
      <h4>No doctor reports uploaded</h4>
      <p>
        Upload a report before granting a patient access.
      </p>
    </div>
  ) : (
    <>
      <div className="form-field">
        <label htmlFor="doctor-record-selection">
          Medical report
        </label>

        <select
          id="doctor-record-selection"
          value={selectedRecordId}
          onChange={(event) =>
            setSelectedRecordId(
              Number(event.target.value)
            )
          }
        >
          {records.map((record) => (
            <option
              key={record.record_id}
              value={record.record_id}
            >
              Medical Record #{record.record_id}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="patient-access-wallet">
          Patient wallet address
        </label>

        <input
          id="patient-access-wallet"
          value={authorisedAccount}
          onChange={(event) =>
            setAuthorisedAccount(
              event.target.value
            )
          }
          placeholder="Enter registered patient wallet"
        />
      </div>

      <div className="permission-status">
        <span
          className={
            doctorHasAccess
              ? "permission-dot active-permission"
              : "permission-dot"
          }
        />

        <div>
          <strong>
            {doctorHasAccess
              ? "Patient access is active"
              : "Patient access is revoked"}
          </strong>

          <p>
            Record #{selectedRecordId} ·{" "}
            {formatAddress(authorisedAccount)}
          </p>
        </div>
      </div>

      <div className="permission-actions">
        <button
          type="button"
          className="page-action-button"
          onClick={handleGrantAccess}
          disabled={
            actionLoading ||
            doctorHasAccess ||
            !authorisedAccount.trim()
          }
        >
          Grant Patient Access
        </button>

        <button
          type="button"
          className="danger-button"
          onClick={handleRevokeAccess}
          disabled={
            actionLoading ||
            !doctorHasAccess ||
            !authorisedAccount.trim()
          }
        >
          Revoke Patient Access
        </button>
      </div>
    </>
  )}
</div>
          <p>
            Records granted to this doctor will appear here in the
            next step.
          </p>

          <div className="form-field">
  <label htmlFor="doctor-patient-wallet">
    Patient wallet address
  </label>

  <input
    id="doctor-patient-wallet"
    value={doctorPatientWallet}
    onChange={(event) =>
      setDoctorPatientWallet(event.target.value)
    }
    placeholder="Enter the patient's blockchain wallet"
  />
</div>

<button
  className="page-action-button"
  onClick={handleLoadSharedRecords}
  disabled={sharedRecordsLoading}
>
  {sharedRecordsLoading
    ? "Loading records..."
    : "Load Shared Records"}
</button>

{sharedRecordsError && (
  <div className="system-message error-message">
    <AlertCircle size={20} />
    <span>{sharedRecordsError}</span>
  </div>
)}

{sharedRecords.length === 0 &&
  !sharedRecordsLoading &&
  !sharedRecordsError && (
    <div className="empty-state">
      <FileText size={34} />
      <h4>No shared records loaded</h4>
      <p>
        Enter a patient wallet to check which records were
        shared with this doctor.
      </p>
    </div>
  )}

{sharedRecords.length > 0 && (
  <div className="records-list doctor-shared-list">
    {sharedRecords.map((record) => (
      <div
        className="record-item"
        key={record.record_id}
      >
        <div className="record-icon">
          <FileText size={22} />
        </div>

        <div className="record-information">
          <strong>
            Medical Record #{record.record_id}
          </strong>

          <p>{record.storage_reference}</p>

          <small>
            Created {formatDate(record.created_at)}
          </small>
        </div>

        <div className="record-meta">
          <span className="verified-badge">
            Access Granted
          </span>

          <button
  type="button"
  className="download-record-button"
  onClick={() =>
    void handleAccessAndDownload(
      record.record_id
    )
  }
  disabled={actionLoading}
>
  {actionLoading
    ? "Opening..."
    : "Open and Download"}
</button>
        </div>
      </div>
    ))}
  </div>
)}
        </article>
            </section>

      <section className="doctor-inbox-section">
        {renderAutomaticSharedRecords()}
      </section>

      {renderUploadModal()}
    </div>
  );
}

if (currentRole === "researcher") {
  return (
    <div style={{ padding: "40px" }}>
      <h1>Researcher Portal</h1>
      <p>Welcome, {patient?.name ?? "Researcher"}</p>
    </div>
  );
}
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={26} />
          </div>

          <div>
            <h1>MediLedger</h1>
            <p>Secure Health Records</p>
          </div>
        </div>

        <nav className="navigation">
          <p className="navigation-label">MAIN MENU</p>

          <button
            className={`navigation-item ${
              activeView === "dashboard" ? "active" : ""
            }`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>

          <button
            className={`navigation-item ${
              activeView === "records" ? "active" : ""
            }`}
            onClick={() => setActiveView("records")}
          >
            <FileText size={20} />
            <span>Medical Records</span>
          </button>

          <button
            className={`navigation-item ${
              activeView === "access" ? "active" : ""
            }`}
            onClick={() => setActiveView("access")}
          >
            <UsersRound size={20} />
            <span>Access Management</span>
          </button>

          <button
            className={`navigation-item ${
              activeView === "audit" ? "active" : ""
            }`}
            onClick={() => setActiveView("audit")}
          >
            <Activity size={20} />
            <span>Audit Logs</span>
          </button>

          <p className="navigation-label settings-label">
            ACCOUNT
          </p>

          <button
            className={`navigation-item ${
              activeView === "profile" ? "active" : ""
            }`}
            onClick={() => setActiveView("profile")}
          >
            <UserRound size={20} />
            <span>Profile</span>
          </button>

          <button
            className={`navigation-item ${
              activeView === "wallet" ? "active" : ""
            }`}
            onClick={() => setActiveView("wallet")}
          >
            <Wallet size={20} />
            <span>Wallet</span>
          </button>
        </nav>

        <div className="sidebar-security">
          <LockKeyhole size={22} />

          <div>
            <strong>Blockchain Secured</strong>
            <p>
              Protected by immutable access controls.
            </p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">PATIENT PORTAL</p>
            <h2>Healthcare Dashboard</h2>
          </div>

          <div className="wallet-profile">
            <button
              className="refresh-button"
              onClick={loadDashboard}
              disabled={loading}
              title="Refresh blockchain data"
            >
              <RefreshCw
                size={18}
                className={loading ? "loading-icon" : ""}
              />
            </button>

            <div className="network-status">
              <span
                className={
                  health?.blockchain_connected
                    ? "status-dot"
                    : "status-dot offline"
                }
              />

              {health?.blockchain_connected
                ? "Blockchain Connected"
                : "Blockchain Offline"}
            </div>

            <div className="wallet-address">
              <Wallet size={18} />
              <span>
                {formatAddress(
                  patient?.wallet ?? PATIENT_ADDRESS
                )}
              </span>
            </div>

            <div className="avatar">
              {patient?.name
                ? patient.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "TP"}
            </div>
            <button
          className="logout-button"
          onClick={() => {
            localStorage.removeItem("mediledger_session");
            setIsLoggedIn(false);
            setCurrentAccount("");
            setCurrentRole(null);
            setPatient(null);
            setRecords([]);
            setNotice(null);
            setError("");
          }}
          >
            Logout
          </button>
          </div>
        </header>

        {loading && (
          <div className="system-message">
            <LoaderCircle
              className="loading-icon"
              size={22}
            />
            <span>Loading blockchain information...</span>
          </div>
        )}

        {error && (
          <div className="system-message error-message">
            <AlertCircle size={22} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            className={`system-message ${
              notice.type === "error"
                ? "error-message"
                : "success-message"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={22} />
            ) : (
              <AlertCircle size={22} />
            )}

            <span>{notice.message}</span>
          </div>
        )}

        {renderCurrentView()}
      </main>
      {renderUploadModal()}
      {accessOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">CONSENT CONTROL</p>
                <h3>Manage Record Access</h3>
              </div>

              <button
                className="modal-close"
                onClick={() => setAccessOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="modal-description">
              Use the Access Management page to grant or revoke
              healthcare-provider permissions.
            </p>

            <button
              className="page-action-button full-width-button"
              onClick={() => {
                setAccessOpen(false);
                setActiveView("access");
              }}
            >
              Open Access Management
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

