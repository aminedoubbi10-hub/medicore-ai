export interface ECGRuleAlerts {
  critical: string[];
  warning: string[];
  info: string[];
}

const LEAD_TERRITORIES: Record<string, string[]> = {
  inferior: ["II", "III", "aVF"],
  anterior: ["V1", "V2", "V3", "V4"],
  lateral: ["I", "aVL", "V5", "V6"],
  high_lateral: ["I", "aVL"],
  posterior_reciprocal: ["V1", "V2", "V3"],
  right_precordial: ["V1", "V2"],
};

export function applyCardioRules(data: any): ECGRuleAlerts {
  const alerts: ECGRuleAlerts = { critical: [], warning: [], info: [] };
  if (!data) return alerts;

  const normalized = normalizeECGData(data);
  const findingsText = [
    ...(normalized.criticalFindings ?? []),
    ...(normalized.primaryFindings ?? []),
    normalized.interpretation,
    normalized.rhythm?.classification,
    normalized.rhythmText,
    normalized.stChanges,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const qtc = normalized.intervals.QTc_ms;
  const qrs = normalized.intervals.QRS_ms;
  const pr = normalized.intervals.PR_ms;
  const hr = normalized.rate.ventricular_bpm;
  const stElev = normalized.stElevationLeads;
  const stDep = normalized.stDepressionLeads;
  const leads = normalized.leadFindings;

  if (qtc !== null && qtc > 500) {
    alerts.critical.push(`QTc ${Math.round(qtc)} ms: critical prolongation screen; torsades risk review required.`);
  } else if (qtc !== null && qtc > 470) {
    alerts.warning.push(`QTc ${Math.round(qtc)} ms: prolonged/borderline QTc screen; verify measurement manually.`);
  }

  if (hasContiguousLeadPattern(stElev, ["inferior", "anterior", "lateral", "high_lateral"]) || /\bstemi\b|st elevation/.test(findingsText)) {
    alerts.critical.push("Possible STEMI pattern screen: immediate physician/cardiologist review and clinical correlation required.");
  }

  if (hasContiguousLeadPattern(stDep, ["posterior_reciprocal"]) || /posterior (mi|infarct)|posterior stemi/.test(findingsText)) {
    alerts.critical.push("Posterior MI screen flag: consider posterior leads V7-V9 and urgent clinical review.");
  }

  if (/wellens/.test(findingsText) || /biphasic|deep.*invert/.test(`${leads.V2 ?? ""} ${leads.V3 ?? ""}`.toLowerCase())) {
    alerts.critical.push("Wellens-pattern screen flag: proximal LAD risk must be reviewed by a clinician; avoid relying on AI alone.");
  }

  if (/brugada/.test(findingsText) || /coved|saddleback/.test(`${leads.V1 ?? ""} ${leads.V2 ?? ""}`.toLowerCase())) {
    alerts.critical.push("Brugada-pattern screen flag: requires clinician/electrophysiology review.");
  }

  if (/wpw|wolff|delta wave/.test(findingsText) || (pr !== null && pr < 120 && qrs !== null && qrs > 110)) {
    alerts.critical.push("WPW/pre-excitation screen flag: verify PR, delta wave, and QRS morphology before management decisions.");
  }

  if (/complete heart block|third degree|3rd degree|av dissociation/.test(findingsText)) {
    alerts.critical.push("Complete heart block screen flag: urgent clinical review and pacing assessment may be needed.");
  }

  if ((normalized.rhythm?.origin === "ventricular" && hr !== null && hr > 100) || /ventricular tachycardia|\bvt\b/.test(findingsText)) {
    alerts.critical.push("Ventricular tachycardia screen flag: urgent assessment required.");
  }

  if (qrs !== null && qrs >= 120 && /lbbb|left bundle/.test(findingsText)) {
    alerts.warning.push("LBBB/wide-QRS screen: apply Sgarbossa/modified Sgarbossa criteria if ischemia is suspected.");
  }

  if (stDep.length >= 2) {
    alerts.warning.push(`ST depression screen in ${stDep.join(", ")}: ischemia/reciprocal-change review required.`);
  }

  if (normalized.imageQuality === "poor" || /poor|low quality|artifact|unreadable/.test(String(normalized.imageQuality).toLowerCase())) {
    alerts.warning.push("Poor ECG image quality: repeat acquisition or manual review is required before acting on AI output.");
  }

  if (alerts.critical.length === 0 && alerts.warning.length === 0) {
    alerts.info.push("No client-side critical ECG rule flags were triggered. This does not exclude disease.");
  }

  return dedupeAlerts(alerts);
}

function normalizeECGData(data: any) {
  const measurements = data.measurements ?? {};
  const aggregate = measurements.image_waveform_screen?.aggregate_measurements ?? {};
  const stScreen = measurements.st_screen ?? data.st_screen ?? aggregate.st_screen ?? {};

  return {
    rate: {
      ventricular_bpm: numberOrNull(data.rate?.ventricular_bpm ?? extractNumber(data.heartRate) ?? measurements.estimated_heart_rate_bpm),
    },
    rhythm: data.rhythm && typeof data.rhythm === "object" ? data.rhythm : undefined,
    rhythmText: typeof data.rhythm === "string" ? data.rhythm : undefined,
    intervals: {
      PR_ms: numberOrNull(data.intervals?.PR_ms ?? extractNumber(data.prInterval)),
      QRS_ms: numberOrNull(data.intervals?.QRS_ms ?? extractNumber(data.qrsDuration) ?? measurements.qrs_duration_ms_estimate),
      QT_ms: numberOrNull(data.intervals?.QT_ms ?? extractNumber(data.qtInterval)),
      QTc_ms: numberOrNull(data.intervals?.QTc_ms ?? extractQTc(data.qtInterval)),
    },
    stElevationLeads: stringArray(data.waveform?.st_segment?.elevation_leads ?? stScreen.possible_st_elevation_leads),
    stDepressionLeads: stringArray(data.waveform?.st_segment?.depression_leads ?? stScreen.possible_st_depression_leads),
    leadFindings: data.lead_findings ?? {},
    primaryFindings: data.primaryFindings ?? [],
    criticalFindings: data.criticalFindings ?? data.critical_findings ?? [],
    interpretation: data.interpretation,
    stChanges: data.stChanges,
    imageQuality: data.image_quality ?? measurements.image_quality?.status ?? measurements.image_waveform_screen?.image_quality?.status,
  };
}

function hasContiguousLeadPattern(leads: string[], territories: string[]) {
  const leadSet = new Set(leads);
  return territories.some((territory) => (LEAD_TERRITORIES[territory] ?? []).filter((lead) => leadSet.has(lead)).length >= 2);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function extractNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function extractQTc(value: unknown): number | null {
  if (typeof value !== "string" || !/qtc/i.test(value)) return null;
  return extractNumber(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dedupeAlerts(alerts: ECGRuleAlerts): ECGRuleAlerts {
  return {
    critical: Array.from(new Set(alerts.critical)),
    warning: Array.from(new Set(alerts.warning)),
    info: Array.from(new Set(alerts.info)),
  };
}
