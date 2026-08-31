import axios, {
  AxiosError,
  type AxiosResponse,
} from "axios";


import { config } from "../config";

export const API_BASE_URL = config.apiBaseUrl;
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});
export interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
}

export class ApiRequestError extends Error {
  status: number | null;
  code: string | null;

  constructor(
    message: string,
    status: number | null = null,
    code: string | null = null
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function getApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof AxiosError) {
    const responseData =
      error.response?.data as ApiErrorResponse | undefined;

    const message =
      responseData?.error ||
      responseData?.message ||
      error.message ||
      "The API request failed.";

    return new ApiRequestError(
      message,
      error.response?.status ?? null,
      responseData?.code ?? null
    );
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message);
  }

  return new ApiRequestError(
    "An unexpected API error occurred."
  );
}

async function unwrap<T>(
  request: Promise<AxiosResponse<T>>
): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    throw getApiError(error);
  }
}

export interface BlockchainHealth {
  status: string;
  blockchain_connected: boolean;
  latest_block: number | null;
  contract_address: string;
}

export interface BlockchainUser {
  wallet: string;
  name: string;
  role: number;
  is_registered: boolean;
}

export interface PatientRecordIds {
  patient: string;
  record_count: number;
  record_ids: number[];
}

export interface MedicalRecord {
  record_id: number;
  patient: string;
  file_hash: string;
  storage_reference: string;
  created_at: number;
  exists: boolean;
}

export interface AccessCheck {
  record_id: number;
  account: string;
  has_access: boolean;
}

export interface TransactionResult {
  message: string;
  transaction_hash: string;
  block_number: number;
}

export function getBlockchainHealth() {
  return unwrap(
    api.get<BlockchainHealth>("/health")
  );
}

export function getUser(account: string) {
  return unwrap(
    api.get<BlockchainUser>(
      `/users/${encodeURIComponent(account)}`
    )
  );
}

export async function getPatientRecordIds(account: string) {
  const response = await api.get<PatientRecordIds>(
    `/patients/${account}/records`
  );

  return response.data;
}

export async function getMedicalRecord(
  recordId: number,
  account: string
) {
  const response = await api.get<MedicalRecord>(
    `/records/${recordId}`,
    {
      params: {
        account,
      },
    }
  );

  return response.data;
}

export async function addMedicalRecord(
  account: string,
  fileHash: string,
  storageReference: string
) {
  const response = await api.post<TransactionResult>(
    "/records",
    {
      account,
      file_hash: fileHash,
      storage_reference: storageReference,
    }
  );

  return response.data;
}

export async function grantRecordAccess(
  patientAccount: string,
  authorisedAccount: string,
  recordId: number
) {
  const response = await api.post<TransactionResult>(
    "/access/grant",
    {
      patient_account: patientAccount,
      authorised_account: authorisedAccount,
      record_id: recordId,
    }
  );

  return response.data;
}

export async function revokeRecordAccess(
  patientAccount: string,
  authorisedAccount: string,
  recordId: number
) {
  const response = await api.post<TransactionResult>(
    "/access/revoke",
    {
      patient_account: patientAccount,
      authorised_account: authorisedAccount,
      record_id: recordId,
    }
  );

  return response.data;
}

export async function checkRecordAccess(
  account: string,
  recordId: number
) {
  const response = await api.get<AccessCheck>(
    "/access/check",
    {
      params: {
        account,
        record_id: recordId,
      },
    }
  );

  return response.data;
}

export async function accessMedicalRecord(
  account: string,
  recordId: number
) {
  const response = await api.post(
    `/records/${recordId}/access`,
    {
      account,
    }
  );

  return response.data;
}
export async function uploadMedicalRecord(
  account: string,
  file: File
) {
  const formData = new FormData();

  formData.append("account", account);
  formData.append("file", file);

  return unwrap(
    api.post(
      "/records/upload",
      formData
    )
  );
}

export function getMedicalRecordDownloadUrl(
  recordId: number,
  account: string
) {
  return (
    `${API_BASE_URL}/records/${recordId}/download` +
    `?account=${encodeURIComponent(account)}`
  );
}
export interface RegisterUserResult {
  message: string;
  transaction_hash: string;
  block_number: number;
  account: string;
  name: string;
  role: number;
}

export async function registerBlockchainUser(
  name: string,
  role: number,
  account: string
) {
  const response = await api.post<RegisterUserResult>(
    "/users/register",
    {
      name,
      role,
      account,
    }
  );

  return response.data;
}
export interface AutoRegisterUserInput {
  full_name: string;
  role: number;
  email?: string;
  password?: string;
  institution?: string;
  department?: string;
  speciality?: string;
  professional_id?: string;
}

export interface AutoRegisterUserResult {
  message: string;
  assigned_wallet: string;
  transaction_hash: string;
  block_number: number;
  profile: {
    id: number;
    wallet_address: string;
    full_name: string;
    role: number;
    email: string | null;
    institution: string | null;
    department: string | null;
    speciality: string | null;
    professional_id: string | null;
    created_at: string;
  };
}

export async function registerUserAutomatically(
  input: AutoRegisterUserInput
) {
  const response = await api.post<AutoRegisterUserResult>(
    "/users/register-auto",
    input
  );

  return response.data;
}

export interface EmailLoginResult {
  wallet_address: string;
}

export async function loginWithEmail(
  email: string,
  password: string
) {
  const response = await api.post<EmailLoginResult>(
    "/users/login-email",
    {
      email,
      password,
    }
  );

  return response.data;
}
export interface UserProfile {
  id: number;
  wallet_address: string;
  full_name: string;
  role: number;
  email: string | null;
  institution: string | null;
  department: string | null;
  speciality: string | null;
  professional_id: string | null;
  created_at: string;
}

export async function getProfile(
  wallet: string
) {
  const response = await api.get<UserProfile>(
    `/profiles/${wallet}`
  );

  return response.data;
}
export interface DoctorSharedRecordsResponse {
  doctor: string;
  patient: string;
  record_count: number;
  records: MedicalRecord[];
}

export async function getDoctorSharedRecords(
  doctorWallet: string,
  patientWallet: string
) {
  const response =
    await api.get<DoctorSharedRecordsResponse>(
      `/doctors/${doctorWallet}/patients/${patientWallet}/shared-records`
    );

  return response.data;
}
export interface PatientSharedRecordsResponse {
  doctor: string;
  patient: string;
  record_count: number;
  records: MedicalRecord[];
}

export async function getPatientSharedRecords(
  patientWallet: string,
  doctorWallet: string
) {
  const response =
    await api.get<PatientSharedRecordsResponse>(
      `/patients/${patientWallet}/doctors/${doctorWallet}/shared-records`
    );

  return response.data;
}
export async function deleteMedicalRecord(
  account: string,
  recordId: number
) {
  const response = await api.delete(
    `/records/${recordId}`,
    {
      data: {
        account,
      },
    }
  );

  return response.data;
}
export interface SharedRecordOwnerProfile {
  full_name: string;
  role: number;
  email: string | null;
  institution: string | null;
  department: string | null;
  speciality: string | null;
  professional_id: string | null;
  wallet_address: string;
}

export interface SharedInboxRecord {
  record_id: number;
  owner_wallet: string;
  file_hash: string;
  storage_reference: string;
  created_at: number;
  exists: boolean;
  owner_profile: SharedRecordOwnerProfile;
}

export interface SharedRecordInboxResponse {
  recipient: string;
  recipient_role: number;
  record_count: number;
  records: SharedInboxRecord[];
}

export async function getSharedRecordInbox(
  wallet: string
) {
  const response =
    await api.get<SharedRecordInboxResponse>(
      `/users/${wallet}/shared-records/inbox`
    );

  return response.data;
}
export interface UserDirectoryResponse {
  count: number;
  users: UserProfile[];
}

export interface UserDirectoryFilters {
  query?: string;
  role?: number;
  institution?: string;
  department?: string;
  speciality?: string;
}

export async function searchUsers(
  filters: UserDirectoryFilters = {}
) {
  return unwrap(
    api.get<UserDirectoryResponse>("/users", {
      params: {
        q: filters.query?.trim() || undefined,
        role: filters.role || undefined,
        institution:
          filters.institution?.trim() || undefined,
        department:
          filters.department?.trim() || undefined,
        speciality:
          filters.speciality?.trim() || undefined,
      },
    })
  );
}

export interface ProfileUpdateInput {
  full_name?: string;
  email?: string | null;
  institution?: string | null;
  department?: string | null;
  speciality?: string | null;
  professional_id?: string | null;
}

export async function updateProfile(
  wallet: string,
  input: ProfileUpdateInput
) {
  return unwrap(
    api.patch<UserProfile>(
      `/profiles/${encodeURIComponent(wallet)}`,
      input
    )
  );
}

export interface AccessLogEntry {
  record_id: number;
  accessed_by: string;
  role: number;
  accessed_at: number;
  accessor_profile: UserProfile | null;
}

export interface RecordAccessLogsResponse {
  record_id: number;
  owner: string;
  log_count: number;
  logs: AccessLogEntry[];
}

export async function getRecordAccessLogs(
  recordId: number,
  ownerWallet: string
) {
  return unwrap(
    api.get<RecordAccessLogsResponse>(
      `/records/${recordId}/audit-logs`,
      {
        params: {
          account: ownerWallet,
        },
      }
    )
  );
}

export interface WalletInformation {
  account: string;
  balance_wei: string;
  balance_eth: string;
  chain_id: number;
  latest_block: number;
  contract_address: string;
  blockchain_connected: boolean;
}

export async function getWalletInformation(
  account: string
) {
  return unwrap(
    api.get<WalletInformation>(
      `/wallets/${encodeURIComponent(account)}`
    )
  );
}
