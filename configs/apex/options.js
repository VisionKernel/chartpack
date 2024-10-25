// Import shared utilities
import { 
    formatDate, 
    formatNumber 
} from '../../utils/formatters.js';

// Calculation utilities
const calculateRoc = (data) => {
    return data.map((point, index, array) => {
        if (index === 0) return { x: point.x, y: 0 };
        const previousValue = array[index - 1].y;
        const roc = (point.y - previousValue) / previousValue * 100;
        return { x: point.x, y: roc };
    });
};

const calculateGrowthOf100 = (data) => {
    const firstValue = data[0].y;
    return data.map(point => ({
        x: point.x,
        y: (point.y / firstValue) * 100
    }));
};

const calculate0To100Scale = (data) => {
    const minValue = Math.min(...data.map(point => point.y));
    const maxValue = Math.max(...data.map(point => point.y));
    const range = maxValue - minValue;
    
    return data.map(point => ({
        x: point.x,
        y: ((point.y - minValue) / range) * 100
    }));
};

// Process series data
const processSeriesData = (series, config) => {
    if (!Array.isArray(series) || series.length === 0) return [];

    return series.map(s => {
        let processedData = s.data
            .filter(point => {
                const isValid = point.x != null && 
                              point.y != null && 
                              !isNaN(point.y) && 
                              !isNaN(new Date(point.x).getTime());
                if (!isValid) console.warn('Filtering invalid point:', point);
                return isValid;
            })
            .map(point => ({
                x: new Date(point.x).getTime(),
                y: parseFloat(point.y)
            }))
            .sort((a, b) => a.x - b.x);

        // Apply display mode calculations
        switch (s.displayMode) {
            case 'ROC':
                processedData = calculateRoc(processedData);
                break;
            case 'Growth of $100':
                processedData = calculateGrowthOf100(processedData);
                break;
            case '0-100 Scale':
                processedData = calculate0To100Scale(processedData);
                break;
        }

        // Apply studies if available
        if (s.studies) {
            s.studies.forEach(study => {
                switch (study) {
                    case 'SMA':
                        processedData = calculateSMA(processedData, 20);
                        break;
                    case 'EMA':
                        processedData = calculateEMA(processedData, 20);
                        break;
                    case 'CAGR':
                        processedData = calculateCAGR(processedData);
                        break;
                    case 'RSI':
                        processedData = calculateRSI(processedData);
                        break;
                }
            });
        }

        // Filter out non-positive values for logarithmic scale
        if (config.isLogarithmic) {
            processedData = processedData.filter(point => point.y > 0);
        }

        return {
            name: s.name.split('.').pop(),
            color: s.color,
            data: processedData,
            displayMode: s.displayMode
        };
    });
};

// Create the main options configuration
export const createChartOptions = (series, config) => {
    const processedSeries = processSeriesData(series, config);
    
    let chartType = 'line';
    switch (config.type) {
        case 'bar':
            chartType = 'bar';
            break;
        case 'area':
            chartType = 'area';
            break;
    }

    // Create recession annotations if enabled
    let recessionAnnotations = [];
    if (config.showRecessions && Array.isArray(config.recessions)) {
        recessionAnnotations = config.recessions.map(recession => ({
            x: new Date(recession.start).getTime(),
            x2: new Date(recession.end).getTime(),
            fillColor: '#f3f3f3',
            opacity: 0.5,
            label: {
                text: '',
                style: { fontSize: '0px' }
            }
        }));
    }

    // Base configuration
    return {
        chart: {
            type: chartType,
            toolbar: { show: false },
            animations: { enabled: false }
        },
        dataLabels: { enabled: false },
        stroke: {
            curve: "straight",
            width: processedSeries.map(s => s.width || 2)
        },
        colors: processedSeries.map(s => s.color),
        tooltip: {
            shared: true,
            intersect: false,
            x: {
                formatter: value => formatDate(value)
            },
            y: {
                formatter: (value, { seriesIndex }) => {
                    const dataset = processedSeries[seriesIndex];
                    switch (dataset.displayMode) {
                        case 'ROC':
                            return `${formatNumber(value)}%`;
                        case 'Growth of $100':
                            return `$${formatNumber(value)}`;
                        case '0-100 Scale':
                            return `${formatNumber(value)} (0-100 scale)`;
                        default:
                            return config.isLogarithmic ? 
                                value.toExponential(2) : 
                                formatNumber(value);
                    }
                }
            }
        },
        grid: { show: true },
        xaxis: {
            type: 'datetime',
            labels: {
                formatter: formatDate,
                rotateAlways: false,
                rotate: -45
            },
            title: {
                text: config.xAxisName || ''
            }
        },
        yaxis: {
            logarithmic: config.isLogarithmic,
            logBase: 10,
            title: {
                text: config.yAxisName || ''
            },
            labels: {
                formatter: value => config.isLogarithmic ? 
                    value.toExponential(2) : 
                    formatNumber(value)
            },
            forceNiceScale: !config.isLogarithmic
        },
        annotations: {
            xaxis: recessionAnnotations,
            yaxis: config.showZeroLine && !config.isLogarithmic ? [{
                y: 0,
                strokeDashArray: 0,
                borderColor: "#000000",
                borderWidth: 1,
                opacity: 1
            }] : []
        },
        legend: {
            show: !config.isPanelView,
            position: 'top',
            horizontalAlign: 'left',
            fontSize: '14px',
            fontFamily: 'Helvetica, Arial, sans-serif',
            offsetY: 10
        }
    };
};