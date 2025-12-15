// src/utils/invoiceHelpers.js
/**
 * Invoice Processing Utilities
 * Helpers for parsing, formatting, and processing invoice data
 * Pattern from Energy.jsx invoice processing
 */

/**
 * Extract company name from invoice filename
 */
export function getCompanyNameFromFilename(filename) {
  if (!filename) return "—";

  let base = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  base = base.replace(/[_-]+/g, " "); // Replace underscores and dashes with spaces
  base = base.replace(/\b\d{6,}\b/g, "").trim(); // Remove numbers
  base = base.replace(/\s+/g, " ").trim(); // Clean whitespace

  return base || filename;
}

/**
 * Get company name from invoice object
 */
export function getCompanyName(invoice) {
  if (
    invoice &&
    typeof invoice.company_name === "string" &&
    invoice.company_name.trim()
  ) {
    return invoice.company_name.trim();
  }

  return getCompanyNameFromFilename(invoice?.filename);
}

/**
 * Get categories from invoice object
 */
export function getInvoiceCategoriesText(invoice) {
  if (
    invoice &&
    Array.isArray(invoice.categories) &&
    invoice.categories.length > 0
  ) {
    return invoice.categories.join(", ");
  }

  return "—";
}

/**
 * Parse date in various formats
 */
export function parseInvoiceDate(value) {
  if (!value) return null;

  const s = value.toString().trim();
  const parts = s.split(/[\/-]/);

  if (parts.length === 3) {
    let [a, b, c] = parts.map((p) => parseInt(p, 10));

    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      // Try YYYY-MM-DD format
      if (a > 31) return new Date(a, b - 1, c);
      // Try DD-MM-YYYY or MM-DD-YYYY
      if (c > 31) return new Date(c, b - 1, a);
    }
  }

  // Try parsing as standard date string
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Get the last N invoices sorted by date
 */
export function getLastNInvoices(invoices, n = 6) {
  if (!Array.isArray(invoices) || invoices.length === 0) return [];

  const withIndex = invoices.map((inv, idx) => ({ inv, idx }));

  // Sort by date (newest first), then by index
  withIndex.sort((a, b) => {
    const da = parseInvoiceDate(a.inv.invoice_date);
    const db = parseInvoiceDate(b.inv.invoice_date);

    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;

    if (tb !== ta) return tb - ta;
    return b.idx - a.idx;
  });

  return withIndex.slice(0, n).map((x) => x.inv);
}

/**
 * Get six-month energy from invoice
 */
export function getInvoiceSixMonthEnergy(invoice) {
  if (!invoice) return null;

  // Try various property names
  if (invoice.sixMonthEnergyKwh != null)
    return Number(invoice.sixMonthEnergyKwh) || 0;
  if (invoice.six_month_energy_kwh != null)
    return Number(invoice.six_month_energy_kwh) || 0;
  if (invoice.previous_6_months_energy_kwh != null)
    return Number(invoice.previous_6_months_energy_kwh) || 0;

  // Try summing history array
  if (Array.isArray(invoice.sixMonthHistory)) {
    return invoice.sixMonthHistory.reduce((sum, m) => {
      const v =
        m && (m.energyKWh != null || m.energy_kwh != null)
          ? Number(m.energyKWh ?? m.energy_kwh)
          : 0;
      return sum + (Number.isNaN(v) ? 0 : v);
    }, 0);
  }

  // Fallback properties
  if (invoice.total_energy_kwh != null) return Number(invoice.total_energy_kwh) || 0;
  if (invoice.energy_kwh != null) return Number(invoice.energy_kwh) || 0;

  return null;
}

/**
 * Group invoices by company
 */
export function groupInvoicesByCompany(invoices) {
  const map = new Map();

  invoices.forEach((inv) => {
    const company = getCompanyName(inv);

    if (!map.has(company)) {
      map.set(company, []);
    }

    map.get(company).push(inv);
  });

  return Array.from(map.entries()).map(([company, rows]) => ({
    company,
    rows,
  }));
}

/**
 * Calculate invoice aggregates
 */
export function calculateInvoiceAggregates(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return {
      totalEnergyKwh: 0,
      totalCurrentCharges: 0,
      totalAmountDue: 0,
      count: 0,
    };
  }

  const aggregates = invoices.reduce(
    (acc, inv) => {
      const sixMonthEnergy = getInvoiceSixMonthEnergy(inv);
      if (sixMonthEnergy != null) {
        acc.totalEnergyKwh += Number(sixMonthEnergy) || 0;
      }
      if (inv.total_current_charges != null) {
        acc.totalCurrentCharges += Number(inv.total_current_charges) || 0;
      }
      if (inv.total_amount_due != null) {
        acc.totalAmountDue += Number(inv.total_amount_due) || 0;
      }
      return acc;
    },
    {
      totalEnergyKwh: 0,
      totalCurrentCharges: 0,
      totalAmountDue: 0,
    }
  );

  return {
    ...aggregates,
    count: invoices.length,
  };
}

/**
 * Sort invoices chronologically
 */
export function sortInvoicesChronologically(invoices) {
  const copy = [...invoices];

  copy.sort((a, b) => {
    const da = parseInvoiceDate(a.invoice_date) || new Date(0);
    const db = parseInvoiceDate(b.invoice_date) || new Date(0);
    return da - db;
  });

  return copy;
}

/**
 * Format currency values
 */
export function formatCurrency(value, currency = "ZAR") {
  if (value == null) return "—";

  const formatted = Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency === "ZAR") return `R${formatted}`;
  if (currency === "USD") return `$${formatted}`;
  if (currency === "EUR") return `€${formatted}`;

  return formatted;
}

/**
 * Format energy values
 */
export function formatEnergy(value) {
  if (value == null) return "—";

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

/**
 * Validate invoice PDF file
 */
export function isValidInvoicePDF(file) {
  if (!file) return false;

  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Extract PDF files from FileList
 */
export function extractPDFFiles(fileList) {
  if (!fileList) return [];

  return Array.from(fileList).filter(isValidInvoicePDF);
}
