import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HealthcareDataSharingModule = buildModule(
  "HealthcareDataSharingModule",
  (m) => {
    const healthcareDataSharing = m.contract(
      "HealthcareDataSharing"
    );

    return { healthcareDataSharing };
  }
);

export default HealthcareDataSharingModule;