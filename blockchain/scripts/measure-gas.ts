import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();

  const publicClient =
    await viem.getPublicClient();

  const [
    patient,
    doctor,
    researcher,
  ] = await viem.getWalletClients();

  const contract =
    await viem.deployContract(
      "HealthcareDataSharing"
    );

  async function measure(
    operation: string,
    transactionHash: `0x${string}`
  ) {
    const receipt =
      await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

    console.log(
      `${operation}: ${receipt.gasUsed.toString()} gas`
    );

    return receipt.gasUsed;
  }

  await measure(
    "Register patient",
    await contract.write.registerUser(
      ["Gas Test Patient", 1],
      {
        account: patient.account,
      }
    )
  );

  await measure(
    "Register doctor",
    await contract.write.registerUser(
      ["Gas Test Doctor", 2],
      {
        account: doctor.account,
      }
    )
  );

  await measure(
    "Register researcher",
    await contract.write.registerUser(
      ["Gas Test Researcher", 3],
      {
        account: researcher.account,
      }
    )
  );

  await measure(
    "Patient record upload",
    await contract.write.addMedicalRecord(
      [
        "gas-test-file-hash",
        "ipfs://gas-test-cid",
      ],
      {
        account: patient.account,
      }
    )
  );

  await measure(
    "Grant doctor access",
    await contract.write.grantAccess(
      [
        1n,
        doctor.account.address,
      ],
      {
        account: patient.account,
      }
    )
  );

  await measure(
    "Doctor accesses record",
    await contract.write.accessMedicalRecord(
      [1n],
      {
        account: doctor.account,
      }
    )
  );

  await measure(
    "Revoke doctor access",
    await contract.write.revokeAccess(
      [
        1n,
        doctor.account.address,
      ],
      {
        account: patient.account,
      }
    )
  );

  await measure(
    "Delete medical record",
    await contract.write.deleteMedicalRecord(
      [1n],
      {
        account: patient.account,
      }
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});