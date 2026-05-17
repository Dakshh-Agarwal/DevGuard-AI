import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';

const ErrorStatsDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'chart', 'detailed'

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/feedback/all`);
      const data = await res.json();
      const grouped = {};

      data.forEach(entry => {
        const key = classifyError(entry.suggestion || 'unknown');
        if (!grouped[key]) {
          grouped[key] = { count: 0, items: [] };
        }
        grouped[key].count += 1;
        grouped[key].items.push(entry);
      });

      setStats(grouped);
    } catch (err) {
      console.error('Error fetching feedback data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const classifyError = (suggestionText) => {
    const text = suggestionText.toLowerCase();
    if (text.includes('syntax') || text.includes('unexpected') || text.includes('missing')) return 'Syntax Error';
    if (text.includes('null') || text.includes('logic') || text.includes('unreachable') || text.includes('condition')) return 'Logic Error';
    if (text.includes('style') || text.includes('format') || text.includes('indent') || text.includes('spacing')) return 'Style Error';
    if (text.includes('deprecated') || text.includes('unused') || text.includes('optimize')) return 'Code Smell';
    if (text.includes('security') || text.includes('vulnerability')) return 'Security Issue';
    if (text.includes('performance') || text.includes('slow') || text.includes('efficiency')) return 'Performance';
    return 'Other';
  };

  const total = Object.values(stats).reduce((sum, s) => sum + s.count, 0);

  const chartData = Object.entries(stats).map(([type, { count }]) => ({
    name: type,
    count,
    percent: ((count / total) * 100).toFixed(1),
  }));

  const pieData = chartData.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length]
  }));

  if (loading) {
    return (
      <div className="container fade-in">
        <div className="text-center py-20">
          <div className="card card-glass inline-block p-8">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-white mb-2">Loading Error Statistics</h2>
            <p className="text-white opacity-80">Analyzing code review patterns...</p>
            <div className="flex justify-center mt-6">
              <div className="loading-spinner"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          📊 Error Analytics Dashboard
        </h1>
        <p className="text-lg text-white opacity-90">
          Comprehensive analysis of code review patterns and error trends
        </p>
        <div className="flex justify-center gap-4 mt-6">
          <button 
            onClick={fetchData}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Data'}
          </button>
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            className="form-select"
          >
            <option value="cards">📱 Card View</option>
            <option value="chart">📊 Chart View</option>
            <option value="detailed">📋 Detailed View</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card card-glass scale-in">
          <div className="card-body text-center">
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-1">Total Issues</h3>
            <p className="text-3xl font-bold text-white">{total}</p>
          </div>
        </div>
        
        <div className="card card-glass scale-in" style={{ animationDelay: '0.1s' }}>
          <div className="card-body text-center">
            <div className="text-4xl mb-2">🏷️</div>
            <h3 className="text-xl font-semibold text-white mb-1">Categories</h3>
            <p className="text-3xl font-bold text-blue-300">{Object.keys(stats).length}</p>
          </div>
        </div>
        
        <div className="card card-glass scale-in" style={{ animationDelay: '0.2s' }}>
          <div className="card-body text-center">
            <div className="text-4xl mb-2">🔥</div>
            <h3 className="text-xl font-semibold text-white mb-1">Most Common</h3>
            <p className="text-xl font-bold text-yellow-300">
              {chartData.length > 0 ? chartData.sort((a, b) => b.count - a.count)[0]?.name : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {Object.entries(stats).map(([type, { count }], index) => (
            <div
              key={type}
              className="card shadow-lg slide-up"
              style={{ 
                animationDelay: `${index * 0.1}s`,
                background: `linear-gradient(135deg, ${getGradientForType(type)})`
              }}
            >
              <div className="card-body text-center">
                <div className="text-4xl mb-3">{getIconForType(type)}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{type}</h3>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-white">{count}</p>
                  <p className="text-white opacity-90">
                    {((count / total) * 100).toFixed(1)}% of total
                  </p>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(count / total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'chart' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Bar Chart */}
          <div className="card shadow-lg slide-up">
            <div className="card-header">
              <h3 className="text-xl font-semibold">📊 Error Distribution</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="count" fill="var(--primary-blue)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="card shadow-lg slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="card-header">
              <h3 className="text-xl font-semibold">🥧 Category Breakdown</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${percent}%`}
                    outerRadius={100}
                    dataKey="count"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'detailed' && (
        <div className="card shadow-lg slide-up">
          <div className="card-header">
            <h3 className="text-xl font-semibold">📋 Detailed Error Analysis</h3>
            <p className="text-gray-600 text-sm">Complete breakdown of all error categories</p>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Error Type</th>
                    <th className="table-header">Count</th>
                    <th className="table-header">Percentage</th>
                    <th className="table-header">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.sort((a, b) => b.count - a.count).map((item, index) => (
                    <tr key={item.name} className={`table-row ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getIconForType(item.name)}</span>
                          <div>
                            <span className="font-semibold">{item.name}</span>
                            <div className="text-sm text-gray-500">{getDescriptionForType(item.name)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-2xl font-bold">{item.count}</span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.percent}%</span>
                          <div className="progress-bar-small">
                            <div 
                              className="progress-fill"
                              style={{ width: `${item.percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          index === 0 ? 'bg-red-100 text-red-800' : 
                          index === 1 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {index === 0 ? '🔴 High' : index === 1 ? '🟡 Medium' : '🟢 Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

  <style>{`
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .grid {
          display: grid;
        }

        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }

        @media (min-width: 768px) {
          .md\\\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .md\\\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .lg\\\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .lg\\\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .gap-6 { gap: 1.5rem; }
        .gap-8 { gap: 2rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-small {
          width: 60px;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: inherit;
          transition: width 0.3s ease;
        }

        .table-header {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-cell {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .table-row:hover {
          background-color: #f9fafb;
        }

        .w-full { width: 100%; }
        .overflow-x-auto { overflow-x: auto; }

        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }

        .text-blue-300 { color: #90cdf4; }
        .text-yellow-300 { color: #fde68a; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }
        .text-sm { font-size: 0.875rem; }
        .text-xl { font-size: 1.25rem; }
        .text-2xl { font-size: 1.5rem; }
        .text-3xl { font-size: 1.875rem; }

        .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }

        .inline-block { display: inline-block; }
        .text-center { text-align: center; }

        .rounded-full { border-radius: 9999px; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
      `}</style>
    </div>
  );
};

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#f5576c", "#4facfe", "#00f2fe", "#96fbc4", "#f9f047"];

const getIconForType = (type) => {
  const icons = {
    'Syntax Error': '🚫',
    'Logic Error': '🧠',
    'Style Error': '🎨',
    'Code Smell': '👃',
    'Security Issue': '🔒',
    'Performance': '⚡',
    'Other': '❓'
  };
  return icons[type] || '📝';
};

const getGradientForType = (type) => {
  const gradients = {
    'Syntax Error': '#ff6b6b, #ee5a24',
    'Logic Error': '#74b9ff, #0984e3',
    'Style Error': '#a29bfe, #6c5ce7',
    'Code Smell': '#fd79a8, #e84393',
    'Security Issue': '#fdcb6e, #e17055',
    'Performance': '#55efc4, #00b894',
    'Other': '#ddd6fe, #8b5cf6'
  };
  return gradients[type] || '#667eea, #764ba2';
};

const getDescriptionForType = (type) => {
  const descriptions = {
    'Syntax Error': 'Missing semicolons, brackets, or invalid syntax',
    'Logic Error': 'Incorrect conditions, null references, unreachable code',
    'Style Error': 'Formatting, indentation, and coding style issues',
    'Code Smell': 'Deprecated methods, unused variables, optimization needed',
    'Security Issue': 'Potential vulnerabilities and security concerns',
    'Performance': 'Inefficient code, slow algorithms, optimization opportunities',
    'Other': 'Miscellaneous suggestions and improvements'
  };
  return descriptions[type] || 'General code improvement suggestions';
};

export default ErrorStatsDashboard;
