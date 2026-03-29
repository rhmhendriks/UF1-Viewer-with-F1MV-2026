/**
 * CarData channel mapping for 2026:
 *   0 = RPM
 *   2 = Speed (km/h)
 *   3 = Gear (0 = neutral)
 *   4 = Throttle (0-100)
 *   5 = Brake (0-100)
 *
 * Channel 1 (ERS) and channel 6 (DRS) are no longer broadcast in 2026.
 * DRS has been replaced by Active Aero which is handled on-car and is not
 * separately surfaced as a telemetry channel in the F1 live timing feed.
 */

function getCarData(driverNumber, carData) {
    try {
        carData[0].Cars[driverNumber].Channels;
    } catch (error) {
        return "error";
    }
    return carData[0].Cars[driverNumber].Channels;
}

function getSpeedThreshold(sessionType, sessionStatus, trackStatus) {
    if (
        sessionType === "Qualifying" ||
        sessionType === "Practice" ||
        trackStatus.Status === "4" ||
        trackStatus.Status === "6" ||
        trackStatus.Status === "7"
    )
        return 10;
    if (sessionStatus === "Inactive" || sessionStatus === "Aborted") return 0;
    return 30;
}

function weirdCarBehaviour(racingNumber, timingData, carData, sessionType, sessionStatus, trackStatus) {
    const driverCarData = getCarData(racingNumber, carData);

    if (driverCarData === "error") return false;

    const driverTimingData = timingData[racingNumber];

    // Access channels by key — channels 0/2/3 are present in 2026 broadcast telemetry
    const rpm   = driverCarData[0];  // RPM
    const speed  = driverCarData[2];  // Speed km/h
    const gear   = driverCarData[3];  // Gear (0=neutral, 1-8=drive)

    const speedLimit = getSpeedThreshold(sessionType, sessionStatus, trackStatus);

    return (
        rpm === 0 ||
        speed <= speedLimit ||
        gear > 8 ||
        gear ===
            (sessionStatus === "Inactive" ||
            sessionStatus === "Aborted" ||
            (sessionType !== "Race" && driverTimingData.PitOut)
                ? ""
                : 0)
    );
}

module.exports = {
    getCarData,
    getSpeedThreshold,
    weirdCarBehaviour,
};
