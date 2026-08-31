import { network } from "hardhat";

/**
 * Measures transaction throughput (TPS) and average per-transaction
 * latency for the HealthcareDataSharing contract, running against
 * the local Hardhat network. Complements measure-gas.ts, which
 * covers per-operation gas cost -- this script covers Objective 6's
 * remaining "transaction throughput and latency" benchmarking
 * requirement.
 *
 * Two scenarios are measured:
 *   1. Sequential throughput: transactions submitted and confirmed
 *      one at a time (closer to a single client's real-world
 *      experience).
 *   2. Batched throughput: multiple transactions submitted
 *      concurrently, then all awaited together (shows the
 *      network's raw processing capacity).
 *
 * Note: figures from a local Hardhat node reflect this development
 * environment's characteristics (instant local mining, no network
 * propagation delay), not a live public or permissioned network.
 * This is stated explicitly in the printed output and should be
 * carried into the dissertation's discussion of these results.
 */

const RECORD_COUNT = 20;

async function main() {
  const { viem } = await network.connect();

  const publicClient = await viem.getPublicClient();
  const [patient] = await viem.getWalletClients();

  const contract = await viem.deployContract(
    "HealthcareDataSharing"
  );

  await contract.write.registerUser(
    ["Benchmark Patient", 1],
    { account: patient.account }
  );

  console.log(
    `\nBenchmarking with ${RECORD_COUNT} record-upload transactions\n`
  );

  // --- Scenario 1: sequential throughput -----------------------

  const sequentialLatenciesMs: number[] = [];
  const sequentialStart = performance.now();

  for (let i = 0; i < RECORD_COUNT; i++) {
    const txStart = performance.now();

    const hash = await contract.write.addMedicalRecord(
      [
        `seq-file-hash-${i}`,
        `seq-storage-ref-${i}`,
      ],
      { account: patient.account }
    );

    await publicClient.waitForTransactionReceipt({
      hash,
    });

    sequentialLatenciesMs.push(
      performance.now() - txStart
    );
  }

  const sequentialTotalSeconds =
    (performance.now() - sequentialStart) / 1000;

  const sequentialTps =
    RECORD_COUNT / sequentialTotalSeconds;

  const sequentialAvgLatencyMs =
    sequentialLatenciesMs.reduce((a, b) => a + b, 0) /
    sequentialLatenciesMs.length;

  console.log("Sequential submission (one at a time):");
  console.log(
    `  Total time: ${sequentialTotalSeconds.toFixed(3)}s`
  );
  console.log(
    `  Throughput: ${sequentialTps.toFixed(2)} TPS`
  );
  console.log(
    `  Average latency per transaction: ` +
      `${sequentialAvgLatencyMs.toFixed(2)}ms`
  );

  // --- Scenario 2: batched (concurrent) throughput --------------

  const batchStart = performance.now();

  const submissions = await Promise.all(
    Array.from({ length: RECORD_COUNT }, (_, i) =>
      contract.write.addMedicalRecord(
        [
          `batch-file-hash-${i}`,
          `batch-storage-ref-${i}`,
        ],
        { account: patient.account }
      )
    )
  );

  await Promise.all(
    submissions.map((hash: `0x${string}`) =>
      publicClient.waitForTransactionReceipt({ hash })
    )
  );

  const batchTotalSeconds =
    (performance.now() - batchStart) / 1000;

  const batchTps = RECORD_COUNT / batchTotalSeconds;

  console.log("\nBatched submission (concurrent):");
  console.log(
    `  Total time: ${batchTotalSeconds.toFixed(3)}s`
  );
  console.log(
    `  Throughput: ${batchTps.toFixed(2)} TPS`
  );

  console.log(
    "\nNote: measured on a local Hardhat development " +
      "network with instant block mining and no network " +
      "propagation delay. These figures characterise this " +
      "development/testing environment, not a live public " +
      "or permissioned deployment."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
