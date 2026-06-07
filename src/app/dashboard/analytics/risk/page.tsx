'use client';

import { useEffect, useState } from 'react';
import { projectsApi, Project } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const RISK_COLORS_MAP: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  'Medium-High': '#f97316',
  High: '#ef4444',
  Variable: '#3b82f6',
};

const CATEGORY_MAP: Record<string, string> = {
  EPC: 'EPC',
  BOT: 'EPC+F',
  PPP: 'PPP',
  CONCESSION: 'Private',
  OTHER: 'Other',
};

export default function RiskAnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await projectsApi.list();
        setProjects(data);
      } catch {
        // Handle error
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
      </div>
    );
  }

  // Calculate risk distribution
  const riskCounts: Record<string, number> = {};
  const categoryRiskCounts: Record<string, Record<string, number>> = {};
  const sectorRiskCounts: Record<string, Record<string, number>> = {};
  const totalValue: Record<string, number> = {};

  projects.forEach(p => {
    const risk = p.riskRating || 'Unknown';
    const category = CATEGORY_MAP[p.projectType || ''] || p.project_type || 'Unknown';
    const sector = p.sector || 'Unknown';
    const value = p.totalCost || p.estimated_cost || 0;

    riskCounts[risk] = (riskCounts[risk] || 0) + 1;
    totalValue[risk] = (totalValue[risk] || 0) + value;

    if (!categoryRiskCounts[category]) categoryRiskCounts[category] = {};
    categoryRiskCounts[category][risk] = (categoryRiskCounts[category][risk] || 0) + 1;

    if (!sectorRiskCounts[sector]) sectorRiskCounts[sector] = {};
    sectorRiskCounts[sector][risk] = (sectorRiskCounts[sector][risk] || 0) + 1;
  });

  const riskPieData = Object.entries(riskCounts).map(([name, value]) => ({ name, value }));

  const categoryBarData = Object.keys(categoryRiskCounts).map(category => ({
    category,
    Low: categoryRiskCounts[category]['Low'] || 0,
    Medium: categoryRiskCounts[category]['Medium'] || 0,
    'Medium-High': categoryRiskCounts[category]['Medium-High'] || 0,
    High: categoryRiskCounts[category]['High'] || 0,
    Variable: categoryRiskCounts[category]['Variable'] || 0,
  }));

  const sectorBarData = Object.keys(sectorRiskCounts)
    .filter(s => s !== 'Unknown')
    .slice(0, 8) // Top 8 sectors
    .map(sector => ({
      sector,
      Low: sectorRiskCounts[sector]['Low'] || 0,
      Medium: sectorRiskCounts[sector]['Medium'] || 0,
      'Medium-High': sectorRiskCounts[sector]['Medium-High'] || 0,
      High: sectorRiskCounts[sector]['High'] || 0,
      Variable: sectorRiskCounts[sector]['Variable'] || 0,
    }));

  const totalProjects = projects.length;
  const highRiskCount = riskCounts['High'] || 0;
  const highRiskPercent = totalProjects ? ((highRiskCount / totalProjects) * 100).toFixed(1) : '0';
  const avgValue = totalProjects ? (projects.reduce((sum, p) => sum + (p.totalCost || p.estimated_cost || 0), 0) / totalProjects) : 0;

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${(val / 1e3).toFixed(0)}K`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Risk Analytics Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Portfolio risk distribution and analysis</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Total Projects</p>
          <p className="text-3xl font-bold text-gray-900">{totalProjects}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">High Risk</p>
          <p className="text-3xl font-bold text-red-600">{highRiskCount}</p>
          <p className="text-xs text-gray-500 mt-1">{highRiskPercent}% of portfolio</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Avg Project Value</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(avgValue)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Total Portfolio Value</p>
          <p className="text-3xl font-bold text-brand-navy">{formatCurrency(Object.values(totalValue).reduce((sum, v) => sum + v, 0))}</p>
        </div>
      </div>

      {/* Risk Distribution Pie Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Risk Distribution</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {riskPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS_MAP[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk by Category */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Risk by Project Category</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Low" stackId="a" fill={RISK_COLORS_MAP['Low']} />
              <Bar dataKey="Medium" stackId="a" fill={RISK_COLORS_MAP['Medium']} />
              <Bar dataKey="Medium-High" stackId="a" fill={RISK_COLORS_MAP['Medium-High']} />
              <Bar dataKey="High" stackId="a" fill={RISK_COLORS_MAP['High']} />
              <Bar dataKey="Variable" stackId="a" fill={RISK_COLORS_MAP['Variable']} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk by Sector */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Risk by Sector (Top 8)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="sector" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Low" stackId="a" fill={RISK_COLORS_MAP['Low']} />
              <Bar dataKey="Medium" stackId="a" fill={RISK_COLORS_MAP['Medium']} />
              <Bar dataKey="Medium-High" stackId="a" fill={RISK_COLORS_MAP['Medium-High']} />
              <Bar dataKey="High" stackId="a" fill={RISK_COLORS_MAP['High']} />
              <Bar dataKey="Variable" stackId="a" fill={RISK_COLORS_MAP['Variable']} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High Risk Projects List */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">High Risk Projects</h2>
        {highRiskCount === 0 ? (
          <p className="text-gray-500 text-sm">No high-risk projects in portfolio</p>
        ) : (
          <div className="space-y-3">
            {projects
              .filter(p => p.riskRating === 'High')
              .slice(0, 10)
              .map(p => (
                <div key={p.id} className="flex items-center justify-between border border-red-200 rounded-lg p-3 bg-red-50/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm">{p.title || p.project_name || p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.sector || 'Unknown Sector'} · {p.country || 'Unknown Country'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      {CATEGORY_MAP[p.projectType || ''] || p.project_type || '—'}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium border border-red-200">
                      High Risk
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
