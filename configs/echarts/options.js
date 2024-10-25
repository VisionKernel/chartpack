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

// Color conversion utilities
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

// Get study color
const getStudyColor = (study, baseColor) => {
    switch (study) {
        case 'SMA': return shiftColor(baseColor, 40);
        case 'EMA': return shiftColor(baseColor, 80);
        case 'CAGR': return shiftColor(baseColor, 120);
        case 'RSI': return shiftColor(baseColor, 160);
        default: return baseColor;
    }
};

// Create series for the chart
const createSeries = (datasets, config) => {
    const { type, showRecessions, recessions, isLogarithmic, showZeroLine, allDates } = config;
    let seriesList = [];

    datasets.forEach(dataset => {
        // Get processed data based on display mode
        let processedData = [...dataset.data];
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

        // Main dataset series
        seriesList.push({
            name: dataset.name.split('.').pop(),
            type: type === 'bar' ? 'bar' : 'line',
            smooth: type !== 'bar',
            areaStyle: type === 'area' ? {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [{
                        offset: 0,
                        color: `${dataset.color || '#1468a8ff'}`
                    }, {
                        offset: 1,
                        color: `${dataset.color || '#1468a8ff'}80`
                    }]
                }
            } : undefined,
            lineStyle: {
                color: dataset.color || '#1468a8ff',
                width: dataset.lineWidth || 2
            },
            itemStyle: {
                color: dataset.color || '#1468a8ff'
            },
            data: allDates.map(date => {
                const point = processedData.find(item => 
                    formatDate(item.x) === date
                );
                return point ? point.y : null;
            }),
            markArea: showRecessions ? {
                itemStyle: { color: 'rgba(169, 169, 169, 0.4)' },
                data: recessions.map(recession => [{
                    xAxis: allDates.findIndex(date => 
                        date >= formatDate(recession.start)
                    )
                }, {
                    xAxis: allDates.findIndex(date => 
                        date >= formatDate(recession.end)
                    )
                }])
            } : undefined
        });

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
                    seriesList.push({
                        name: `${dataset.name.split('.').pop()} - ${study}`,
                        type: 'line',
                        smooth: true,
                        lineStyle: {
                            color: getStudyColor(study, dataset.color || '#1468a8ff'),
                            width: 1
                        },
                        data: allDates.map(date => {
                            const point = studyData.find(item => 
                                formatDate(item.x) === date
                            );
                            return point ? point.y : null;
                        })
                    });
                }
            });
        }
    });

    // Add zero line if needed
    if (showZeroLine && !isLogarithmic) {
        seriesList.push({
            type: 'line',
            markLine: {
                silent: true,
                symbol: 'none',
                label: { show: false },
                data: [{ yAxis: 0 }],
                lineStyle: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    type: 'dashed',
                    width: 1
                }
            }
        });
    }

    return seriesList;
};

export const createChartOptions = (data, config) => {
    const {
        xAxisName,
        yAxisName,
        isLogarithmic,
        isPanelView,
        showLegend = true,
        showXAxisLabel = true
    } = config;

    // Get all unique dates from the data
    const allDates = [...new Set(
        data.flatMap(dataset => 
            dataset.data.map(item => formatDate(item.x))
        )
    )].sort();

    return {
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const date = new Date(params[0].axisValue);
                let result = `${formatDate(date)}<br/>`;
                
                params.forEach(param => {
                    if (param.value != null) {
                        const dataset = data.find(d => 
                            d.name.split('.').pop() === param.seriesName.split(' - ')[0]
                        );

                        let formattedValue;
                        if (dataset) {
                            switch (dataset.displayMode) {
                                case 'ROC':
                                    formattedValue = `${param.value.toFixed(2)}%`;
                                    break;
                                case 'Growth of $100':
                                    formattedValue = `$${param.value.toFixed(2)}`;
                                    break;
                                case '0-100 Scale':
                                    formattedValue = `${param.value.toFixed(2)} (0-100 scale)`;
                                    break;
                                default:
                                    formattedValue = isLogarithmic ? 
                                        param.value.toExponential(2) : 
                                        param.value.toLocaleString();
                            }
                        } else {
                            formattedValue = param.value.toFixed(2);
                        }
                        result += `${param.seriesName}: ${formattedValue}<br/>`;
                    } else {
                        result += `${param.seriesName}: N/A<br/>`;
                    }
                });
                return result;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: showXAxisLabel ? '10%' : '3%',
            top: showLegend ? '15%' : '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: allDates,
            name: showXAxisLabel ? xAxisName : '',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { fontWeight: 'bold' },
            axisLabel: {
                formatter: value => new Date(value).getFullYear(),
                interval: 'auto',
                rotate: 45,
                show: showXAxisLabel
            },
            splitLine: {
                show: true,
                lineStyle: { 
                    type: 'dashed', 
                    color: '#ddd' 
                }
            }
        },
        yAxis: {
            type: isLogarithmic ? 'log' : 'value',
            name: yAxisName,
            nameTextStyle: { fontWeight: 'bold' },
            axisLabel: {
                formatter: value => {
                    if (isLogarithmic) return value.toExponential(0);
                    const dataset = data[0];
                    switch (dataset.displayMode) {
                        case 'ROC':
                            return `${value.toFixed(2)}%`;
                        case 'Growth of $100':
                            return `$${value.toFixed(2)}`;
                        case '0-100 Scale':
                            return value.toFixed(2);
                        default:
                            return value.toLocaleString();
                    }
                }
            },
            splitLine: {
                show: true,
                lineStyle: { 
                    type: 'dashed', 
                    color: '#ddd' 
                }
            },
            logBase: 10
        },
        series: createSeries(data, { ...config, allDates }),
        legend: {
            show: showLegend,
            data: createSeries(data, { ...config, allDates })
                .map(series => series.name)
        }
    };
};