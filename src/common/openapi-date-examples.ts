// Documentation-only date presets shared by history and PR query DTOs, so the
// reference UI can switch between the demo range and an empty range.
export const fromDateExamples = {
  demoRange: { summary: 'Aug–Sep 2026 (demo data)', value: '2026-08-01' },
  noData: { summary: 'Jan 2025 (no data → 200 empty)', value: '2025-01-01' },
};

export const toDateExamples = {
  demoRange: { summary: 'Aug–Sep 2026 (demo data)', value: '2026-09-30' },
  noData: { summary: 'Jan 2025 (no data → 200 empty)', value: '2025-01-31' },
};
