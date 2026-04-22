const ACTIVITY_MULTIPLIERS = {
  low: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

function getSexConstant(sex) {
  const normalizedSex = typeof sex === 'string' ? sex.trim().toLowerCase() : '';
  if (normalizedSex === 'male') return 5;
  if (normalizedSex === 'female') return -161;
  return -78;
}

function collectMissingMaintenanceFields(biometrics = {}) {
  const missing = [];

  if (!Number.isFinite(Number(biometrics.age)) || Number(biometrics.age) <= 0) {
    missing.push('age');
  }
  if (typeof biometrics.sex !== 'string' || !biometrics.sex.trim()) {
    missing.push('sex');
  }
  if (!Number.isFinite(Number(biometrics.heightIn)) || Number(biometrics.heightIn) <= 0) {
    missing.push('heightIn');
  }
  if (!Number.isFinite(Number(biometrics.weightLbs)) || Number(biometrics.weightLbs) <= 0) {
    missing.push('weightLbs');
  }
  if (!ACTIVITY_MULTIPLIERS[biometrics.activityLevel]) {
    missing.push('activityLevel');
  }

  return missing;
}

function calculateMaintenanceCalories(biometrics = {}) {
  const missingFields = collectMissingMaintenanceFields(biometrics);
  if (missingFields.length) {
    return {
      available: false,
      calories: null,
      missingFields
    };
  }

  const age = Number(biometrics.age);
  const heightIn = Number(biometrics.heightIn);
  const weightLbs = Number(biometrics.weightLbs);
  const activityLevel = biometrics.activityLevel;

  const weightKg = weightLbs / 2.2046226218;
  const heightCm = heightIn * 2.54;
  const bmr =
    (10 * weightKg) +
    (6.25 * heightCm) -
    (5 * age) +
    getSexConstant(biometrics.sex);
  const calories = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);

  return {
    available: true,
    calories,
    bmr: Math.round(bmr),
    activityLevel,
    activityMultiplier: ACTIVITY_MULTIPLIERS[activityLevel],
    missingFields: []
  };
}

export { ACTIVITY_MULTIPLIERS, calculateMaintenanceCalories, collectMissingMaintenanceFields };
