// Common utility functions
export const formatters = {
    formatDate: (date) => new Date(date).toLocaleDateString(),
    formatNumber: (num) => num.toLocaleString(),
    formatPercent: (num) => `${(num * 100).toFixed(1)}%`,
  };
  
  // Chart.js Configuration Generator
  export const getChartJsConfig = (data, chartConfig) => {
    return {
      type: chartConfig.chartType || 'line',
      data: {
        labels: data.date,
        datasets: chartConfig.datasets.map(dataset => ({
          label: dataset.name,
          data: data.value,
          borderColor: dataset.color || '#f9912f',
          backgroundColor: 'rgba(249, 145, 47, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartConfig.title || ''
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: chartConfig.xAxisName || ''
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: chartConfig.yAxisName || ''
            }
          }
        }
      }
    };
  };
  
  // Plotly Configuration Generator
  export const getPlotlyConfig = (data, chartConfig) => {
    return {
      data: chartConfig.datasets.map(dataset => ({
        type: chartConfig.chartType || 'scatter',
        mode: 'lines',
        name: dataset.name,
        x: data.date,
        y: data.value,
        line: {
          color: dataset.color || '#f9912f',
          width: 2
        }
      })),
      layout: {
        title: chartConfig.title || '',
        showlegend: true,
        xaxis: {
          title: chartConfig.xAxisName || '',
          showgrid: true
        },
        yaxis: {
          title: chartConfig.yAxisName || '',
          showgrid: true
        },
        margin: { t: 50, r: 50, b: 50, l: 50 },
        height: 400,
        width: 800
      },
      config: {
        responsive: true
      }
    };
  };
  
  // ApexCharts Configuration Generator
  export const getApexChartsConfig = (data, chartConfig) => {
    return {
      chart: {
        type: chartConfig.chartType || 'line',
        height: 400,
        width: 800,
        toolbar: {
          show: true
        },
        zoom: {
          enabled: true
        }
      },
      series: chartConfig.datasets.map(dataset => ({
        name: dataset.name,
        data: data.value
      })),
      xaxis: {
        categories: data.date,
        title: {
          text: chartConfig.xAxisName || ''
        }
      },
      yaxis: {
        title: {
          text: chartConfig.yAxisName || ''
        }
      },
      title: {
        text: chartConfig.title || '',
        align: 'center'
      },
      colors: chartConfig.datasets.map(dataset => dataset.color || '#f9912f'),
      stroke: {
        curve: 'smooth',
        width: 2
      },
      legend: {
        position: 'top'
      },
      dataLabels: {
        enabled: false
      }
    };
  };
  
  // ECharts Configuration Generator
  export const getEChartsConfig = (data, chartConfig) => {
    return {
      title: {
        text: chartConfig.title || '',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: chartConfig.datasets.map(dataset => dataset.name),
        top: '10%'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.date,
        name: chartConfig.xAxisName || '',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: chartConfig.yAxisName || '',
        nameLocation: 'middle',
        nameGap: 50
      },
      series: chartConfig.datasets.map(dataset => ({
        name: dataset.name,
        type: chartConfig.chartType || 'line',
        data: data.value,
        itemStyle: {
          color: dataset.color || '#f9912f'
        },
        lineStyle: {
          width: 2
        },
        smooth: true
      }))
    };
  };
  
  // Recharts Configuration Generator
  export const getRechartsConfig = (data, chartConfig) => {
    // Transform data to Recharts format
    const transformedData = data.date.map((date, index) => ({
      date,
      ...chartConfig.datasets.reduce((acc, dataset) => {
        acc[dataset.name] = data.value[index];
        return acc;
      }, {})
    }));
  
    return {
      width: 800,
      height: 400,
      data: transformedData,
      margin: { top: 20, right: 30, left: 20, bottom: 30 },
      cartesianGrid: {
        strokeDasharray: '3 3'
      },
      xAxis: {
        dataKey: 'date',
        label: chartConfig.xAxisName || '',
        scale: 'auto'
      },
      yAxis: {
        label: chartConfig.yAxisName || '',
        scale: 'auto'
      },
      tooltip: {
        formatter: formatters.formatNumber
      },
      legend: {
        verticalAlign: 'top',
        height: 36
      },
      lines: chartConfig.datasets.map(dataset => ({
        type: 'monotone',
        dataKey: dataset.name,
        stroke: dataset.color || '#f9912f',
        strokeWidth: 2,
        dot: false
      }))
    };
  };
  
  // Helper function to get the right configuration based on library
  export const getChartConfig = (data, chartConfig) => {
    const configs = {
      'Chart.js': getChartJsConfig,
      'Plotly': getPlotlyConfig,
      'ApexCharts': getApexChartsConfig,
      'ECharts': getEChartsConfig,
      'Recharts': getRechartsConfig
    };
  
    const configGenerator = configs[chartConfig.chartLibrary];
    if (!configGenerator) {
      throw new Error(`Unsupported chart library: ${chartConfig.chartLibrary}`);
    }
  
    return configGenerator(data, chartConfig);
  };
  
  // Export default configuration options
  export const defaultOptions = {
    colors: {
      primary: '#f9912f',
      secondary: '#4299e1',
      tertiary: '#48bb78'
    },
    chartTypes: {
      line: 'line',
      bar: 'bar',
      area: 'area',
      scatter: 'scatter'
    },
    themes: {
      light: {
        background: '#ffffff',
        text: '#1a202c',
        grid: '#e2e8f0'
      },
      dark: {
        background: '#1a202c',
        text: '#ffffff',
        grid: '#2d3748'
      }
    }
  };