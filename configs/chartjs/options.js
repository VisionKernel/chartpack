// Import shared utilities
import { formatDate, formatNumber } from '../../utils/formatters.js';

// Color utilities
const shiftColor = (color, degree) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const hsl = rgbToHsl(r, g, b);
    hsl[0] = (hsl[0] + degree) % 360;
    const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
    
    return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
};

const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// Get study color variation
const getStudyColor = (study, baseColor) => {
    switch (study) {
        case 'SMA': return shiftColor(baseColor, 40);
        case 'EMA': return shiftColor(baseColor, 80);
        case 'CAGR': return shiftColor(baseColor, 120);
        case 'RSI': return shiftColor(baseColor, 160);
        default: return baseColor;
    }
};

// Process data for chart
const processChartData = (datasets, config) => {
    const processedDatasets = [];
    const { type, isPanelView } = config;

    datasets.forEach(dataset => {
        let processedData = [...dataset.data];

        // Apply display mode calculations
        switch (dataset.displayMode) {
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

        // Add main dataset
        const baseDataset = {
            label: dataset.name.split('.').pop(),
            data: processedData,
            fill: type === 'area' ? 'origin' : false,
            backgroundColor: type === 'bar' ? 
                dataset.color || '#1468a8ff' : 
                type === 'area' ? 
                    `${dataset.color || '#1468a8ff'}80` : 
                    'rgba(0, 0, 0, 0)',
            borderColor: dataset.color || '#1468a8ff',
            borderWidth: dataset.lineWidth || 2,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 0,
        };

        processedDatasets.push(baseDataset);

        // Add study lines if present
        if (dataset.studies) {
            dataset.studies.forEach(study => {
                let studyData;
                switch (study) {
                    case 'SMA':
                        studyData = calculateSMA(processedData, 20);
                        break;
                    case 'EMA':
                        studyData = calculateEMA(processedData, 20);
                        break;
                    case 'CAGR':
                        studyData = calculateCAGR(processedData);
                        break;
                    case 'RSI':
                        studyData = calculateRSI(processedData);
                        break;
                }

                if (studyData) {
                    processedDatasets.push({
                        label: `${baseDataset.label} - ${study}`,
                        data: studyData,
                        borderColor: getStudyColor(study, dataset.color),
                        borderWidth: 1,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                    });
                }
            });
        }
    });

    return { datasets: processedDatasets };
};

// Create chart options
export const createChartOptions = (data, config) => {
    const {
        xAxisName,
        yAxisName,
        isLogarithmic,
        isPanelView,
        showZeroLine,
        showRecessions,
        recessions = []
    } = config;

    // Calculate date range
    const allDates = data.flatMap(dataset => 
        dataset.data.map(item => new Date(item.x))
    );
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Filter recessions within date range
    const filteredRecessions = showRecessions ? 
        recessions.filter(recession => {
            const recessionStart = new Date(recession.start);
            const recessionEnd = new Date(recession.end);
            return recessionStart <= maxDate && recessionEnd >= minDate;
        }) : [];

    return {
        data: processChartData(data, config),
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        tooltipFormat: 'yyyy-MM-dd',
                    },
                    title: {
                        display: true,
                        text: xAxisName,
                    },
                    min: minDate,
                    max: maxDate,
                },
                y: {
                    type: isLogarithmic ? 'logarithmic' : 'linear',
                    beginAtZero: !isLogarithmic,
                    title: {
                        display: true,
                        text: yAxisName,
                    },
                    ticks: {
                        callback: (value) => {
                            if (isLogarithmic) {
                                const baseNumber = Math.pow(10, Math.floor(Math.log10(value)));
                                return value === baseNumber ? 
                                    value.toLocaleString() : '';
                            }
                            return value.toLocaleString();
                        }
                    }
                },
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    display: !isPanelView,
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
                                const dataset = data.find(d => 
                                    d && d.name === context.dataset.label
                                );
                                if (dataset?.displayMode) {
                                    switch (dataset.displayMode) {
                                        case 'ROC':
                                            label += '%';
                                            break;
                                        case 'Growth of $100':
                                            label += ' ($100 base)';
                                            break;
                                        case '0-100 Scale':
                                            label += ' (0-100 scale)';
                                            break;
                                    }
                                }
                            }
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: [
                        ...filteredRecessions.map((recession, index) => ({
                            type: 'box',
                            xMin: new Date(recession.start),
                            xMax: new Date(recession.end),
                            backgroundColor: 'rgba(169, 169, 169, 0.4)',
                            borderColor: 'rgba(169, 169, 169, 0.4)',
                            borderWidth: 0,
                            label: {
                                display: !isPanelView,
                                content: recession.name,
                                position: 'start',
                                yAdjust: -(index * 20),
                                font: {
                                    size: 10
                                }
                            }
                        })),
                        ...(showZeroLine ? [{
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgba(0, 0, 0, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                        }] : [])
                    ]
                }
            },
            maintainAspectRatio: false,
        }
    };
};