// Import shared utilities
import { formatDate, formatNumber } from '../../utils/formatters.js';

// Color utilities
const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
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

const getStudyColor = (study, baseColor) => {
    const shiftColor = (color, degree) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const hsl = rgbToHsl(r, g, b);
        hsl[0] = (hsl[0] + degree) % 360;
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };

    switch (study) {
        case 'SMA': return shiftColor(baseColor, 40);
        case 'EMA': return shiftColor(baseColor, 80);
        case 'CAGR': return shiftColor(baseColor, 120);
        case 'RSI': return shiftColor(baseColor, 160);
        default: return baseColor;
    }
};

const createHoverTemplate = (dataset, isLogarithmic) => {
    const baseTemplate = dataset.displayMode === 'ROC' ? '%{y:.2f}%' :
                        dataset.displayMode === 'Growth of $100' ? '$%{y:.2f}' :
                        dataset.displayMode === '0-100 Scale' ? '%{y:.2f} (0-100 scale)' :
                        isLogarithmic ? '%{y:.2e}' : '%{y:,.2f}';
    return `%{x|%Y-%m-%d}<br>${baseTemplate}<extra></extra>`;
};

const createTrace = (dataset, config) => {
    const { type, isPanelView, isLogarithmic } = config;
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

    const baseTrace = {
        x: processedData.map(item => item.x),
        y: processedData.map(item => item.y),
        name: dataset.name.split('.').pop(),
        marker: { color: dataset.color || '#1468a8ff' },
        showlegend: !isPanelView,
        hovertemplate: createHoverTemplate(dataset, isLogarithmic)
    };

    // Create main trace based on chart type
    const mainTrace = (() => {
        switch (type) {
            case 'bar':
                return {
                    ...baseTrace,
                    type: 'bar',
                    marker: { color: dataset.color || '#1468a8ff' },
                };
            case 'area':
                return {
                    ...baseTrace,
                    type: 'scatter',
                    mode: 'none',
                    fill: 'tozeroy',
                    fillcolor: `${dataset.color || '#1468a8ff'}80`,
                };
            default:
                return {
                    ...baseTrace,
                    type: 'scatter',
                    mode: 'lines',
                    line: { 
                        color: dataset.color || '#1468a8ff', 
                        width: dataset.lineWidth || 2 
                    },
                };
        }
    })();

    // Add study traces if present
    const studyTraces = dataset.studies ? dataset.studies.map(study => {
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
            default:
                studyData = [];
        }
        return {
            x: studyData.map(item => item.x),
            y: studyData.map(item => item.y),
            name: `${dataset.name.split('.').pop()} - ${study}`,
            type: 'scatter',
            mode: 'lines',
            line: { 
                color: getStudyColor(study, dataset.color || '#1468a8ff'),
                width: 1
            },
            showlegend: !isPanelView,
            hovertemplate: createHoverTemplate(dataset, isLogarithmic)
        };
    }) : [];

    return [mainTrace, ...studyTraces];
};

export const createChartOptions = (data, config) => {
    const {
        xAxisName,
        yAxisName,
        isLogarithmic,
        isPanelView,
        showZeroLine,
        showRecessions,
        recessions = [],
        showXAxis = true
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

    // Create layout
    const layout = {
        autosize: true,
        margin: { 
            l: 50, 
            r: 50, 
            b: showXAxis ? 100 : 20, 
            t: 20, 
            pad: 4 
        },
        xaxis: { 
            title: showXAxis ? xAxisName : '',
            range: [minDate, maxDate],
            showticklabels: showXAxis,
        },
        yaxis: { 
            title: yAxisName,
            type: isLogarithmic ? 'log' : 'linear',
            tickformat: isLogarithmic ? '.2e' : ',',
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        legend: isPanelView ? 
            { visible: false } : 
            {
                orientation: 'h',
                y: 1.2,
                x: 0.5,
                xanchor: 'center',
                traceorder: 'normal',
            },
        hovermode: 'closest',
        hoverlabel: {
            namelength: -1
        },
        shapes: [
            ...showRecessions ? filteredRecessions.map(recession => ({
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: recession.start,
                x1: recession.end,
                y0: 0,
                y1: 1,
                fillcolor: 'rgba(169, 169, 169, 0.4)',
                line: { width: 0 },
            })) : [],
            ...(showZeroLine && !isLogarithmic ? [{
                type: 'line',
                xref: 'paper',
                yref: 'y',
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 0,
                line: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    width: 1,
                    dash: 'dash',
                }
            }] : [])
        ],
    };

    // Create traces
    const traces = data.flatMap(dataset => 
        createTrace(dataset, config)
    );

    return {
        data: traces,
        layout,
        config: {
            responsive: true,
            displayModeBar: false,
        }
    };
};