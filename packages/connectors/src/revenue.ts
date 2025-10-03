export async function submitTR2Draft(payload: Record<string, unknown>) {
  // Stub: would call Revenue ROS or provide filing guidance
  return { status: "queued", reference: "ROS-DEMO", payload };
}

export async function fetchRevenueCharityRegistrations() {
  // Placeholder implementation until Revenue API integration lands
  return [
    {
      registrationNumber: "CHY00001",
      name: "Fresh Example CLG",
      status: "Registered",
      lastUpdated: new Date().toISOString()
    },
    {
      registrationNumber: "CHY00002",
      name: "Sample Charity Limited",
      status: "Registered",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()
    }
  ];
}
