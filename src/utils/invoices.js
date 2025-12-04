// src/utils/invoices.js

// Same factor as backend – single source of truth
export const EF_ELECTRICITY_T_PER_KWH = 0.0009;

/**
 * Safely parse invoice date (supports a few common formats).
 */
export const parseInvoiceDate = (value) => {
  if (!value) return null;
  const s = value.toString().trim();
  const parts = s.split(/[\/-]/);
  if (parts.length === 3) {
    let [a, b, c] = parts.map((p) => parseInt(p, 10));
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      // handle YYYY-MM-DD vs DD-MM-YYYY
      if (a > 31) return new Date(a, b - 1, c);
      if (c > 31) return new Date(c, b - 1, a);
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Get last 6 invoices by date (newest first, with stable tiebreaker).
 */
export const getLastSixInvoices = (invoices) => {
  if (!Array.isArray(invoices) || invoices.length === 0) return [];
  const withIndex = invoices.map((inv, idx) => ({ inv, idx }));
  withIndex.sort((a, b) => {
    const da = parseInvoiceDate(a.inv.invoice_date);
    const db = parseInvoiceDate(b.inv.invoice_date);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.idx - a.idx;
  });
  return withIndex.slice(0, 6).map((x) => x.inv);
};

/**
 * Energy (kWh – last 6 months) per invoice.
 */
export const getInvoiceSixMonthEnergy = (inv) => {
  if (!inv) return null;

  if (inv.sixMonthEnergyKwh != null) return Number(inv.sixMonthEnergyKwh) || 0;
  if (inv.six_month_energy_kwh != null)
    return Number(inv.six_month_energy_kwh) || 0;
  if (inv.previous_6_months_energy_kwh != null)
    return Number(inv.previous_6_months_energy_kwh) || 0;

  if (Array.isArray(inv.sixMonthHistory)) {
    return inv.sixMonthHistory.reduce((sum, m) => {
      const v =
        m && (m.energyKWh != null || m.energy_kwh != null)
          ? Number(m.energyKWh ?? m.energy_kwh)
          : 0;
      return sum + (Number.isNaN(v) ? 0 : v);
    }, 0);
  }

  if (inv.total_energy_kwh != null) return Number(inv.total_energy_kwh) || 0;
  if (inv.energy_kwh != null) return Number(inv.energy_kwh) || 0;

  return null;
};

/**
 * Aggregated energy + carbon from a set of invoices.
 * Uses sixMonthHistory when present, otherwise invoice-level totals.
 */
export const computeInvoiceEnergyAndCarbon = (invoices) => {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { totalEnergyKwh: null, totalCarbonTonnes: null };
  }

  let totalEnergy = 0;
  let totalCarbon = 0;

  invoices.forEach((inv) => {
    let usedHistory = false;

    if (Array.isArray(inv.sixMonthHistory) && inv.sixMonthHistory.length) {
      usedHistory = true;
      inv.sixMonthHistory.forEach((m) => {
        if (!m) return;

        // energy
        if (m.energyKWh != null || m.energy_kwh != null) {
          const ev = Number(m.energyKWh ?? m.energy_kwh);
          if (!Number.isNaN(ev)) totalEnergy += ev;
        }

        // carbon – prefer explicit tCO2e, else compute from energy
        if (
          m.co2Tonnes != null ||
          m.co2_tonnes != null ||
          m.co2 != null
        ) {
          const cv = Number(m.co2Tonnes ?? m.co2_tonnes ?? m.co2);
          if (!Number.isNaN(cv)) totalCarbon += cv;
        } else if (m.energyKWh != null || m.energy_kwh != null) {
          const ev2 = Number(m.energyKWh ?? m.energy_kwh);
          if (!Number.isNaN(ev2)) {
            totalCarbon += ev2 * EF_ELECTRICITY_T_PER_KWH;
          }
        }
      });
    }

    // if no month history, fall back to invoice-level totals
    if (!usedHistory) {
      if (inv.total_energy_kwh != null) {
        const eInv = Number(inv.total_energy_kwh);
        if (!Number.isNaN(eInv)) {
          totalEnergy += eInv;
          if (inv.estimated_co2_tonnes != null) {
            const cInv = Number(inv.estimated_co2_tonnes);
            if (!Number.isNaN(cInv)) totalCarbon += cInv;
          } else {
            totalCarbon += eInv * EF_ELECTRICITY_T_PER_KWH;
          }
        }
      }
    }
  });

  return {
    totalEnergyKwh: totalEnergy || null,
    totalCarbonTonnes: totalCarbon || null,
  };
};
