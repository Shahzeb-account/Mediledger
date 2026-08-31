import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("HealthcareDataSharing", async function () {
  const { viem } = await network.connect();

  const publicClient = await viem.getPublicClient();

  type TestContract = Awaited<
    ReturnType<typeof deployContract>
  >;

  async function deployContract() {
    return viem.deployContract(
      "HealthcareDataSharing"
    );
  }

  async function waitForTransaction(
    transactionHash: `0x${string}`
  ) {
    return publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
  }

  async function registerUser(
    contract: TestContract,
    walletClient: any,
    name: string,
    role: number
  ) {
    const transactionHash =
      await contract.write.registerUser(
        [name, role],
        {
          account: walletClient.account,
        }
      );

    await waitForTransaction(transactionHash);
  }

  async function addRecord(
    contract: TestContract,
    walletClient: any,
    fileHash = "hash-test-record",
    storageReference =
      "storage/test-record.enc"
  ) {
    const transactionHash =
      await contract.write.addMedicalRecord(
        [fileHash, storageReference],
        {
          account: walletClient.account,
        }
      );

    await waitForTransaction(transactionHash);

    return transactionHash;
  }

  async function grantAccess(
    contract: TestContract,
    owner: any,
    recipientAddress: `0x${string}`,
    recordId = 1n
  ) {
    const transactionHash =
      await contract.write.grantAccess(
        [recordId, recipientAddress],
        {
          account: owner.account,
        }
      );

    await waitForTransaction(transactionHash);

    return transactionHash;
  }

  async function revokeAccess(
    contract: TestContract,
    owner: any,
    recipientAddress: `0x${string}`,
    recordId = 1n
  ) {
    const transactionHash =
      await contract.write.revokeAccess(
        [recordId, recipientAddress],
        {
          account: owner.account,
        }
      );

    await waitForTransaction(transactionHash);

    return transactionHash;
  }

  describe("User registration", function () {
    it("registers a patient successfully", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      const user = await contract.read.getUser([
        patient.account.address,
      ]);

      assert.equal(
        user[0].toLowerCase(),
        patient.account.address.toLowerCase()
      );

      assert.equal(user[1], "Test Patient");
      assert.equal(Number(user[2]), 1);
      assert.equal(user[3], true);
    });

    it("registers a doctor successfully", async function () {
      const contract = await deployContract();

      const [, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      const user = await contract.read.getUser([
        doctor.account.address,
      ]);

      assert.equal(Number(user[2]), 2);
      assert.equal(user[3], true);
    });

    it("registers a researcher successfully", async function () {
      const contract = await deployContract();

      const [, , researcher] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        researcher,
        "Test Researcher",
        3
      );

      const user = await contract.read.getUser([
        researcher.account.address,
      ]);

      assert.equal(Number(user[2]), 3);
      assert.equal(user[3], true);
    });

    it("rejects duplicate registration", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await assert.rejects(
        contract.write.registerUser(
          ["Duplicate Patient", 1],
          {
            account: patient.account,
          }
        )
      );
    });

    it("rejects an empty name", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await assert.rejects(
        contract.write.registerUser(
          ["", 1],
          {
            account: patient.account,
          }
        )
      );
    });

    it("rejects the None role", async function () {
      const contract = await deployContract();

      const [account] =
        await viem.getWalletClients();

      await assert.rejects(
        contract.write.registerUser(
          ["Invalid User", 0],
          {
            account: account.account,
          }
        )
      );
    });

    it("rejects an out-of-range role", async function () {
      const contract = await deployContract();

      const [account] =
        await viem.getWalletClients();

      await assert.rejects(
        contract.write.registerUser(
          ["Invalid Role User", 4],
          {
            account: account.account,
          }
        )
      );
    });
  });

  describe("Medical record creation", function () {
    it("allows a patient to upload a record", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(
        contract,
        patient,
        "patient-hash",
        "storage/patient-record.enc"
      );

      const record =
        await contract.read.getMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      assert.equal(record[0], 1n);

      assert.equal(
        record[1].toLowerCase(),
        patient.account.address.toLowerCase()
      );

      assert.equal(record[2], "patient-hash");

      assert.equal(
        record[3],
        "storage/patient-record.enc"
      );

      assert.equal(record[5], true);
    });

    it("allows a doctor to upload a record", async function () {
      const contract = await deployContract();

      const [, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(
        contract,
        doctor,
        "doctor-report-hash",
        "storage/doctor-report.enc"
      );

      const record =
        await contract.read.getMedicalRecord(
          [1n],
          {
            account: doctor.account,
          }
        );

      assert.equal(
        record[1].toLowerCase(),
        doctor.account.address.toLowerCase()
      );

      assert.equal(
        record[2],
        "doctor-report-hash"
      );
    });

    it("prevents a researcher from uploading a record", async function () {
      const contract = await deployContract();

      const [, , researcher] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        researcher,
        "Test Researcher",
        3
      );

      await assert.rejects(
        contract.write.addMedicalRecord(
          [
            "researcher-hash",
            "storage/researcher.enc",
          ],
          {
            account: researcher.account,
          }
        )
      );
    });

    it("prevents an unregistered account from uploading", async function () {
      const contract = await deployContract();

      const [, , , unregistered] =
        await viem.getWalletClients();

      await assert.rejects(
        contract.write.addMedicalRecord(
          [
            "unregistered-hash",
            "storage/unregistered.enc",
          ],
          {
            account: unregistered.account,
          }
        )
      );
    });

    it("rejects an empty file hash", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await assert.rejects(
        contract.write.addMedicalRecord(
          ["", "storage/record.enc"],
          {
            account: patient.account,
          }
        )
      );
    });

    it("rejects an empty storage reference", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await assert.rejects(
        contract.write.addMedicalRecord(
          ["valid-hash", ""],
          {
            account: patient.account,
          }
        )
      );
    });

    it("returns owner record IDs", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(
        contract,
        patient,
        "hash-1",
        "storage/record-1.enc"
      );

      await addRecord(
        contract,
        patient,
        "hash-2",
        "storage/record-2.enc"
      );

      const recordIds =
        await contract.read.getOwnerRecordIds([
          patient.account.address,
        ]);

      assert.deepEqual(recordIds, [1n, 2n]);
    });
  });

  describe("Patient sharing", function () {
    it("allows a patient to share with a doctor", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      const access =
        await contract.read.hasAccess([
          1n,
          doctor.account.address,
        ]);

      assert.equal(access, true);
    });

    it("allows a patient to share with a researcher", async function () {
      const contract = await deployContract();

      const [patient, , researcher] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        researcher,
        "Test Researcher",
        3
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        researcher.account.address
      );

      const access =
        await contract.read.hasAccess([
          1n,
          researcher.account.address,
        ]);

      assert.equal(access, true);
    });

    it("prevents a patient from sharing with another patient", async function () {
      const contract = await deployContract();

      const [patient, otherPatient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Record Owner",
        1
      );

      await registerUser(
        contract,
        otherPatient,
        "Other Patient",
        1
      );

      await addRecord(contract, patient);

      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            otherPatient.account.address,
          ],
          {
            account: patient.account,
          }
        )
      );
    });
  });

  describe("Doctor sharing", function () {
    it("allows a doctor to share a report with a patient", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(
        contract,
        doctor,
        "doctor-report-hash",
        "storage/doctor-report.enc"
      );

      await grantAccess(
        contract,
        doctor,
        patient.account.address
      );

      const access =
        await contract.read.hasAccess([
          1n,
          patient.account.address,
        ]);

      assert.equal(access, true);
    });

    it("prevents a doctor from sharing with another doctor", async function () {
      const contract = await deployContract();

      const [, doctor, secondDoctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        doctor,
        "Doctor One",
        2
      );

      await registerUser(
        contract,
        secondDoctor,
        "Doctor Two",
        2
      );

      await addRecord(contract, doctor);

      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            secondDoctor.account.address,
          ],
          {
            account: doctor.account,
          }
        )
      );
    });

    it("prevents a doctor from sharing with a researcher", async function () {
      const contract = await deployContract();

      const [, doctor, researcher] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await registerUser(
        contract,
        researcher,
        "Test Researcher",
        3
      );

      await addRecord(contract, doctor);

      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            researcher.account.address,
          ],
          {
            account: doctor.account,
          }
        )
      );
    });
  });

  describe("Replay-style and duplicate misuse", function () {
    it("rejects granting the same access twice", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            doctor.account.address,
          ],
          {
            account: patient.account,
          }
        )
      );
    });

    it("rejects revoking the same access twice", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      await revokeAccess(
        contract,
        patient,
        doctor.account.address
      );

      await assert.rejects(
        contract.write.revokeAccess(
          [
            1n,
            doctor.account.address,
          ],
          {
            account: patient.account,
          }
        )
      );
    });

    it("rejects duplicate record deletion", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(contract, patient);

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      await assert.rejects(
        contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        )
      );
    });
  });

  describe("Record deletion security", function () {
    it("allows the owner to delete a record", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(contract, patient);

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      const isDeleted =
        await contract.read.isRecordDeleted([
          1n,
        ]);

      assert.equal(isDeleted, true);
    });

    it("prevents another patient from deleting the record", async function () {
      const contract = await deployContract();

      const [owner, attacker] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        owner,
        "Record Owner",
        1
      );

      await registerUser(
        contract,
        attacker,
        "Other Patient",
        1
      );

      await addRecord(contract, owner);

      await assert.rejects(
        contract.write.deleteMedicalRecord(
          [1n],
          {
            account: attacker.account,
          }
        )
      );
    });

    it("prevents an authorised doctor from deleting a patient record", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      await assert.rejects(
        contract.write.deleteMedicalRecord(
          [1n],
          {
            account: doctor.account,
          }
        )
      );
    });

    it("prevents an unregistered user from deleting a record", async function () {
      const contract = await deployContract();

      const [patient, unregistered] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(contract, patient);

      await assert.rejects(
        contract.write.deleteMedicalRecord(
          [1n],
          {
            account: unregistered.account,
          }
        )
      );
    });
  });

  describe("Deleted-record access", function () {
    it("prevents the owner from reading a deleted record", async function () {
      const contract = await deployContract();

      const [patient] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await addRecord(contract, patient);

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      await assert.rejects(
        contract.read.getMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        )
      );
    });

    it("prevents an authorised doctor from reading after deletion", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      await assert.rejects(
        contract.read.getMedicalRecord(
          [1n],
          {
            account: doctor.account,
          }
        )
      );
    });

    it("prevents checking active access after deletion", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      await assert.rejects(
        contract.read.hasAccess([
          1n,
          doctor.account.address,
        ])
      );
    });

    it("prevents granting access to a deleted record", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      const transactionHash =
        await contract.write.deleteMedicalRecord(
          [1n],
          {
            account: patient.account,
          }
        );

      await waitForTransaction(transactionHash);

      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            doctor.account.address,
          ],
          {
            account: patient.account,
          }
        )
      );
    });
  });

  describe("Audit logging", function () {
    it("creates an access log after authorised access", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      const accessTransaction =
        await contract.write.accessMedicalRecord(
          [1n],
          {
            account: doctor.account,
          }
        );

      await waitForTransaction(
        accessTransaction
      );

      const logs =
        await contract.read.getRecordAccessLogs(
          [1n],
          {
            account: patient.account,
          }
        );

      assert.equal(logs.length, 1);

      assert.equal(
        logs[0].accessedBy.toLowerCase(),
        doctor.account.address.toLowerCase()
      );

      assert.equal(Number(logs[0].role), 2);
    });

    it("prevents a non-owner from viewing access logs", async function () {
      const contract = await deployContract();

      const [patient, doctor] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        doctor,
        "Test Doctor",
        2
      );

      await addRecord(contract, patient);

      await grantAccess(
        contract,
        patient,
        doctor.account.address
      );

      await assert.rejects(
        contract.read.getRecordAccessLogs(
          [1n],
          {
            account: doctor.account,
          }
        )
      );
    });
  });

  describe("Sybil resistance", function () {
    it("gives a self-created second identity no automatic access to the patient's own records", async function () {
      const contract = await deployContract();

      const [patient, sockPuppet] =
        await viem.getWalletClients();

      // Same real-world person could, in principle, control
      // both wallets. Both must still register independently --
      // there is no mechanism by which controlling multiple
      // addresses grants any elevated privilege.
      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        sockPuppet,
        "Second Identity",
        1
      );

      await addRecord(contract, patient);

      const hasAccess =
        await contract.read.hasAccess([
          1n,
          sockPuppet.account.address,
        ]);

      assert.equal(hasAccess, false);
    });

    it("prevents a self-created second identity from granting itself access without the true owner's consent", async function () {
      const contract = await deployContract();

      const [patient, sockPuppet] =
        await viem.getWalletClients();

      await registerUser(
        contract,
        patient,
        "Test Patient",
        1
      );

      await registerUser(
        contract,
        sockPuppet,
        "Second Identity",
        1
      );

      await addRecord(contract, patient);

      // The second identity does not own the record, so it
      // cannot call grantAccess to authorise itself, regardless
      // of how many wallets the same person controls.
      await assert.rejects(
        contract.write.grantAccess(
          [
            1n,
            sockPuppet.account.address,
          ],
          {
            account: sockPuppet.account,
          }
        )
      );
    });
  });
});