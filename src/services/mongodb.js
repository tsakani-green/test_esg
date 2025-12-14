import { MongoClient } from 'mongodb';

class MongoDBService {
  constructor() {
    // MongoDB Atlas connection string from environment variables
    this.MONGO_URI = import.meta.env.VITE_MONGO_URI || 'mongodb+srv://esgAdmin:Tsakani3408@africaesg-cluster.36oy0su.mongodb.net/?appName=AfricaESG-Cluster';
    this.DB_NAME = import.meta.env.VITE_MONGO_DB_NAME || 'esg_app';
    this.client = null;
    this.db = null;
    
    // Collections
    this.COLLECTIONS = {
      INVOICES: 'invoices',
      ENVIRONMENTAL_DATA: 'environmental_data',
      COMPANIES: 'companies',
      USERS: 'users',
      ESG_REPORTS: 'esg_reports'
    };
  }

  // Connect to MongoDB
  async connect() {
    try {
      if (!this.client) {
        this.client = new MongoClient(this.MONGO_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
        await this.client.connect();
        this.db = this.client.db(this.DB_NAME);
        console.log('Connected to MongoDB Atlas');
      }
      return this.db;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  // Close connection
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  // Invoice Operations
  async saveInvoice(invoiceData) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      // Add metadata
      const enrichedInvoice = {
        ...invoiceData,
        _id: invoiceData.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        processed: true,
        dataSource: 'pdf_upload',
        version: '1.0'
      };

      // Upsert based on unique identifier
      const result = await collection.updateOne(
        { 
          $or: [
            { _id: enrichedInvoice._id },
            { 'tax_invoice_number': invoiceData.tax_invoice_number },
            { 'filename': invoiceData.filename }
          ]
        },
        { $set: enrichedInvoice },
        { upsert: true }
      );

      console.log(`Invoice saved/updated: ${result.upsertedId || result.modifiedCount} document(s)`);
      return enrichedInvoice;
    } catch (error) {
      console.error('Error saving invoice:', error);
      throw error;
    }
  }

  async saveBulkInvoices(invoiceList) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      const enrichedInvoices = invoiceList.map(invoice => ({
        ...invoice,
        _id: invoice.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        processed: true,
        dataSource: 'pdf_upload',
        version: '1.0'
      }));

      // Insert many with error handling for duplicates
      const result = await collection.insertMany(enrichedInvoices, { ordered: false });
      console.log(`${result.insertedCount} invoices saved to MongoDB`);
      return enrichedInvoices;
    } catch (error) {
      // Handle partial success (some documents may have been inserted)
      if (error.writeErrors) {
        console.log(` Some invoices saved, ${error.writeErrors.length} errors`);
        return enrichedInvoices.filter((_, index) => !error.writeErrors.some(e => e.index === index));
      }
      throw error;
    }
  }

  async getAllInvoices(filters = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      // Build query
      const query = {};
      if (filters.company) query.company = filters.company;
      if (filters.startDate || filters.endDate) {
        query.uploadedAt = {};
        if (filters.startDate) query.uploadedAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.uploadedAt.$lte = new Date(filters.endDate);
      }

      const invoices = await collection.find(query)
        .sort({ uploadedAt: -1 })
        .toArray();
      
      return invoices;
    } catch (error) {
      console.error(' Error fetching invoices:', error);
      throw error;
    }
  }

  async getInvoicesByCompany(companyName) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      const invoices = await collection.find({ 
        $or: [
          { company_name: companyName },
          { 'companyName': companyName }
        ]
      })
      .sort({ invoice_date: -1 })
      .toArray();
      
      return invoices;
    } catch (error) {
      console.error(' Error fetching company invoices:', error);
      throw error;
    }
  }

  // Environmental Data Operations
  async saveEnvironmentalData(environmentalData) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.ENVIRONMENTAL_DATA);
      
      const enrichedData = {
        ...environmentalData,
        _id: environmentalData.id || `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        dataType: environmentalData.dataType || 'manual_upload'
      };

      const result = await collection.updateOne(
        { _id: enrichedData._id },
        { $set: enrichedData },
        { upsert: true }
      );

      console.log(` Environmental data saved: ${result.upsertedId || result.modifiedCount} document(s)`);
      return enrichedData;
    } catch (error) {
      console.error(' Error saving environmental data:', error);
      throw error;
    }
  }

  async getEnvironmentalData(filters = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.ENVIRONMENTAL_DATA);
      
      const query = {};
      if (filters.dataType) query.dataType = filters.dataType;
      if (filters.startDate) query.uploadedAt = { $gte: new Date(filters.startDate) };

      const data = await collection.find(query)
        .sort({ uploadedAt: -1 })
        .toArray();
      
      return data;
    } catch (error) {
      console.error(' Error fetching environmental data:', error);
      throw error;
    }
  }

  //  Company Operations
  async saveCompany(companyData) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.COMPANIES);
      
      const enrichedCompany = {
        ...companyData,
        _id: companyData.id || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: companyData.createdAt || new Date(),
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { 
          $or: [
            { _id: enrichedCompany._id },
            { name: companyData.name }
          ]
        },
        { $set: enrichedCompany },
        { upsert: true }
      );

      console.log(`Company saved: ${result.upsertedId || result.modifiedCount} document(s)`);
      return enrichedCompany;
    } catch (error) {
      console.error(' Error saving company:', error);
      throw error;
    }
  }

  async getCompanies() {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.COMPANIES);
      
      const companies = await collection.find({})
        .sort({ name: 1 })
        .toArray();
      
      return companies;
    } catch (error) {
      console.error(' Error fetching companies:', error);
      throw error;
    }
  }

  async updateCompanyStats(companyName, stats) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.COMPANIES);
      
      await collection.updateOne(
        { name: companyName },
        { 
          $set: { 
            ...stats,
            updatedAt: new Date()
          },
          $inc: { invoiceCount: 1 }
        },
        { upsert: true }
      );
      
      console.log(`Company stats updated: ${companyName}`);
    } catch (error) {
      console.error(' Error updating company stats:', error);
      throw error;
    }
  }

  // Dashboard Aggregation
  async getDashboardStats() {
    try {
      const db = await this.connect();
      
      // Get total invoices count
      const invoicesCount = await db.collection(this.COLLECTIONS.INVOICES).countDocuments();
      
      // Get total companies count
      const companiesCount = await db.collection(this.COLLECTIONS.COMPANIES).countDocuments();
      
      // Aggregate total energy and charges
      const energyAggregation = await db.collection(this.COLLECTIONS.INVOICES)
        .aggregate([
          {
            $group: {
              _id: null,
              totalEnergy: { 
                $sum: { 
                  $cond: [
                    { $ifNull: ["$six_month_energy_kwh", false] },
                    "$six_month_energy_kwh",
                    { $ifNull: ["$total_energy_kwh", 0] }
                  ]
                }
              },
              totalCharges: { 
                $sum: { $ifNull: ["$total_current_charges", 0] }
              }
            }
          }
        ]).toArray();

      const totals = energyAggregation[0] || { totalEnergy: 0, totalCharges: 0 };
      const totalCarbon = totals.totalEnergy * 0.00099; // Using EF_ELECTRICITY_T_PER_KWH

      // Get latest update timestamp
      const latestInvoice = await db.collection(this.COLLECTIONS.INVOICES)
        .find()
        .sort({ uploadedAt: -1 })
        .limit(1)
        .toArray();

      return {
        totalInvoices: invoicesCount,
        totalCompanies: companiesCount,
        totalEnergy: totals.totalEnergy,
        totalCharges: totals.totalCharges,
        totalCarbon: totalCarbon,
        lastUpdated: latestInvoice[0]?.uploadedAt || new Date(),
        latestInvoice: latestInvoice[0] || null
      };
    } catch (error) {
      console.error(' Error getting dashboard stats:', error);
      throw error;
    }
  }

  async getMonthlyChartData(months = 6) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      // Get invoices with sixMonthHistory
      const invoices = await collection.find({
        sixMonthHistory: { $exists: true, $ne: [] }
      }).toArray();

      // Process monthly data
      const monthlyData = {};
      
      invoices.forEach(invoice => {
        const history = invoice.sixMonthHistory || [];
        history.forEach(month => {
          const monthLabel = month.month_label || month.month || 'Unknown';
          if (!monthlyData[monthLabel]) {
            monthlyData[monthLabel] = {
              energy: 0,
              carbon: 0,
              charges: 0,
              invoices: 0
            };
          }
          
          const energy = Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
          monthlyData[monthLabel].energy += energy;
          monthlyData[monthLabel].carbon += energy * 0.00099;
          monthlyData[monthLabel].charges += Number(month.total_current_charges ?? month.current_charges ?? 0) || 0;
          monthlyData[monthLabel].invoices += 1;
        });
      });

      // Convert to array and sort
      const chartData = Object.entries(monthlyData).map(([month, data]) => ({
        name: month,
        energy: data.energy,
        carbon: data.carbon,
        charges: data.charges,
        invoices: data.invoices
      })).sort((a, b) => a.name.localeCompare(b.name));

      return chartData.slice(-months);
    } catch (error) {
      console.error(' Error getting chart data:', error);
      throw error;
    }
  }

  //  Data Export
  async exportData(dataType = 'invoices') {
    try {
      const db = await this.connect();
      let data;
      
      switch (dataType) {
        case 'invoices':
          data = await db.collection(this.COLLECTIONS.INVOICES).find({}).toArray();
          break;
        case 'environmental':
          data = await db.collection(this.COLLECTIONS.ENVIRONMENTAL_DATA).find({}).toArray();
          break;
        case 'companies':
          data = await db.collection(this.COLLECTIONS.COMPANIES).find({}).toArray();
          break;
        default:
          const [invoices, environmental, companies] = await Promise.all([
            db.collection(this.COLLECTIONS.INVOICES).find({}).toArray(),
            db.collection(this.COLLECTIONS.ENVIRONMENTAL_DATA).find({}).toArray(),
            db.collection(this.COLLECTIONS.COMPANIES).find({}).toArray()
          ]);
          data = { invoices, environmental, companies };
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      throw error;
    }
  }

  //  Cleanup/Delete Operations
  async deleteInvoices(companyName = null) {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.INVOICES);
      
      const query = companyName ? { company_name: companyName } : {};
      const result = await collection.deleteMany(query);
      
      console.log(`Deleted ${result.deletedCount} invoices`);
      return result.deletedCount;
    } catch (error) {
      console.error(' Error deleting invoices:', error);
      throw error;
    }
  }

  async deleteEnvironmentalData() {
    try {
      const db = await this.connect();
      const collection = db.collection(this.COLLECTIONS.ENVIRONMENTAL_DATA);
      
      const result = await collection.deleteMany({});
      console.log(` Deleted ${result.deletedCount} environmental data records`);
      return result.deletedCount;
    } catch (error) {
      console.error(' Error deleting environmental data:', error);
      throw error;
    }
  }
}

// Singleton instance
const mongoDBService = new MongoDBService();
export default mongoDBService;