const PlotlyChartSystem = (function() {
    // Utility functions
    const utils = {
        getTableName: (fullName) => {
            const parts = fullName.split('.');
            return parts[parts.length - 1];
        },

        formatHoverTemplate: (dataset, isLogarithmic) => {
            const baseTemplate = dataset.displayMode === 'ROC' ? '%{y:.2f}%' :
                               dataset.displayMode === 'Growth of $100' ? '$%{y:.2f}' :
                               dataset.displayMode === '0-100 Scale' ? '%{y:.2f} (0-100 scale)' :
                               isLogarithmic ? '%{y:.2e}' : '%{y:,.2f}';
            return `%{x|%Y-%m-%d}<br>${baseTemplate}<extra></extra>`;
        }
    };

    // Basic calculations
    const calculations = {
        calculateRoc: (data) => {
            return data.map((point, index, array) => {
                if (index === 0) return { x: point.x, y: 0 };
                const previousValue = array[index - 1].y;
                const roc = (point.y - previousValue) / previousValue * 100;
                return { x: point.x, y: roc };
            });
        },

        calculateGrowthOf100: (data) => {
            const firstValue = data[0].y;
            return data.map(point => ({
                x: point.x,
                y: (point.y / firstValue) * 100
            }));
        },

        calculate0To100Scale: (data) => {
            const minValue = Math.min(...data.map(point => point.y));
            const maxValue = Math.max(...data.map(point => point.y));
            const range = maxValue - minValue;
            
            return data.map(point => ({
                x: point.x,
                y: ((point.y - minValue) / range) * 100
            }));
        }
    };

    // Technical Indicators
    const technicalIndicators = {
        calculateSMA: (data, period = 20) => {
            return data.map((point, index, array) => {
                if (index < period - 1) return { x: point.x, y: null };
                const slice = array.slice(index - period + 1, index + 1);
                const sum = slice.reduce((sum, curr) => sum + curr.y, 0);
                return { x: point.x, y: sum / period };
            });
        },

        calculateEMA: (data, period = 20) => {
            const multiplier = 2 / (period + 1);
            let ema = data[0].y;
            
            return data.map((point, index) => {
                if (index === 0) return { x: point.x, y: ema };
                ema = (point.y - ema) * multiplier + ema;
                return { x: point.x, y: ema };
            });
        },

        calculateCAGR: (data) => {
            const firstValue = data[0].y;
            const lastValue = data[data.length - 1].y;
            const years = (new Date(data[data.length - 1].x) - new Date(data[0].x)) / 
                         (1000 * 60 * 60 * 24 * 365);
            const cagr = (Math.pow(lastValue / firstValue, 1 / years) - 1) * 100;

            return data.map(point => ({
                x: point.x,
                y: cagr
            }));
        },

        calculateRSI: (data, period = 14) => {
            const changes = data.map((point, index, array) => {
                if (index === 0) return 0;
                return point.y - array[index - 1].y;
            });

            const gains = changes.map(change => change > 0 ? change : 0);
            const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

            let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
            let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

            return data.map((point, index) => {
                if (index < period) return { x: point.x, y: null };

                if (index > period) {
                    avgGain = (avgGain * (period - 1) + gains[index]) / period;
                    avgLoss = (avgLoss * (period - 1) + losses[index]) / period;
                }

                const rs = avgGain / avgLoss;
                const rsi = 100 - (100 / (1 + rs));

                return { x: point.x, y: rsi };
            });
        }
    };

    // Color utilities
    const colorUtils = {
        rgbToHsl: (r, g, b) => {
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
        },

        hslToRgb: (h, s, l) => {
            h /= 360; s /= 100; l /= 100;
            let r, g, b;

            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }

            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        },

        getStudyColor: (study, baseColor) => {
            const shiftColor = (color, degree) => {
                const hex = color.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                
                const hsl = colorUtils.rgbToHsl(r, g, b);
                hsl[0] = (hsl[0] + degree) % 360;
                const rgb = colorUtils.hslToRgb(hsl[0], hsl[1], hsl[2]);
                
                return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            };

            switch (study) {
                case 'SMA': return shiftColor(baseColor, 40);
                case 'EMA': return shiftColor(baseColor, 80);
                case 'CAGR': return shiftColor(baseColor, 120);
                case 'RSI': return shiftColor(baseColor, 160);
                default: return baseColor;
            }
        }
    };

    // Process data for cloud function format
    const processCloudData = (rawData, cloudConfig) => {
        const { datasets } = cloudConfig;
        
        return datasets.map(dataset => {
            // Filter data for this dataset
            const datasetData = rawData.filter(point => 
                point.dataset_id === dataset.id
            );

            // Process the data points
            let processedData = datasetData
                .filter(point => {
                    if (!point.date || !point.value || isNaN(point.value)) {
                        console.warn(`Filtering out invalid data point:`, point);
                        return false;
                    }
                    return true;
                })
                .map(point => ({
                    x: new Date(point.date),
                    y: parseFloat(point.value)
                }))
                .sort((a, b) => a.x - b.x);

            // Apply display mode calculations
            switch (dataset.displayMode) {
                case 'ROC':
                    processedData = calculations.calculateRoc(processedData);
                    break;
                case 'Growth of $100':
                    processedData = calculations.calculateGrowthOf100(processedData);
                    break;
                case '0-100 Scale':
                    processedData = calculations.calculate0To100Scale(processedData);
                    break;
            }

            // Apply technical indicators if specified
            let studyData = [];
            if (dataset.studies) {
                studyData = dataset.studies.map(study => ({
                    study,
                    data: technicalIndicators[`calculate${study}`](processedData)
                }));
            }

            return {
                name: dataset.name,
                color: dataset.color || '#1468a8ff',
                data: processedData,
                studies: studyData,
                displayMode: dataset.displayMode
            };
        });
    };

    // Create chart with cloud function configuration
    const createChart = (containerId, rawData, cloudConfig) => {
        try {
            const container = document.getElementById(containerId);
            if (!container) throw new Error('Container not found');

            // Initialize state
            window.chartRendered = false;

            // Process configuration
            const config = {
                type: cloudConfig.basicInfo.chartType || 'line',
                xAxisName: cloudConfig.axisConfig.xAxisName || '',
                yAxisName: cloudConfig.axisConfig.yAxisName || '',
                isLogarithmic: cloudConfig.displaySettings.isLogarithmic || false,
                isPanelView: cloudConfig.displaySettings.isPanelView || false,
                showZeroLine: cloudConfig.displaySettings.showZeroLine || false,
                showRecessions: cloudConfig.displaySettings.showRecessionLines || false,
                recessions: cloudConfig.additionalSettings.recessions || []
            };

            // Process the data
            const processedData = processCloudData(rawData, cloudConfig);

            // Calculate date range
            const allDates = processedData.flatMap(dataset => 
                dataset.data.map(item => item.x)
            );
            const minDate = new Date(Math.min(...allDates));
            const maxDate = new Date(Math.max(...allDates));

            // Plotly configuration
            const plotlyConfig = {
                responsive: true,
                displayModeBar: false
            };

            // Create charts based on view type
            if (config.isPanelView) {
                // Set up container for panels
                container.innerHTML = '';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';

                // Create individual panels
                const promises = processedData.map((dataset, index) => {
                    return new Promise(resolve => {
                        const panelDiv = document.createElement('div');
                        panelDiv.style.flex = '1';
                        panelDiv.style.marginBottom = 
                            index < processedData.length - 1 ? '20px' : '0';
                        container.appendChild(panelDiv);

                        Plotly.newPlot(
                            panelDiv,
                            createTraces(dataset, config),
                            createLayout({
                                ...config,
                                minDate,
                                maxDate,
                                showXAxis: index === processedData.length - 1
                            }),
                            plotlyConfig
                        ).then(resolve);
                    });
                });

                // Signal completion when all panels are rendered
                Promise.all(promises).then(() => {
                    window.chartRendered = true;
                });
            } else {
                // Create single chart with all datasets
                const traces = processedData.flatMap(dataset => 
                    createTraces(dataset, config)
                );

                Plotly.newPlot(
                    containerId,
                    traces,
                    createLayout({
                        ...config,
                        minDate,
                        maxDate
                    }),
                    plotlyConfig
                ).then(() => {
                    window.chartRendered = true;
                });
            }
        } catch (error) {
            console.error('Error creating chart:', error);
            throw error;
        }
    };

    // Create traces for Plotly
    const createTraces = (dataset, config) => {
        const traces = [];

        // Create main trace
        const mainTrace = {
            x: dataset.data.map(item => item.x),
            y: dataset.data.map(item => item.y),
            name: dataset.name,
            marker: { color: dataset.color },
            showlegend: !config.isPanelView,
            hovertemplate: utils.formatHoverTemplate(dataset, config.isLogarithmic)
        };

        // Apply type-specific settings
        switch (config.type) {
            case 'bar':
                traces.push({
                    ...mainTrace,
                    type: 'bar'
                });
                break;
            case 'area':
                traces.push({
                    ...mainTrace,
                    type: 'scatter',
                    mode: 'none',
                    fill: 'tozeroy',
                    fillcolor: `${dataset.color}80`
                });
                break;
            default:
                traces.push({
                    ...mainTrace,
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: dataset.color,
                        width: dataset.lineWidth || 2
                    }
                });
        }

        // Add study traces
        if (dataset.studies) {
            dataset.studies.forEach(studyData => {
                traces.push({
                    x: studyData.data.map(item => item.x),
                    y: studyData.data.map(item => item.y),
                    name: `${dataset.name} - ${studyData.study}`,
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                        color: colorUtils.getStudyColor(studyData.study, dataset.color),
                        width: 1
                    },
                    showlegend: !config.isPanelView,
                    hovertemplate: utils.formatHoverTemplate(dataset, config.isLogarithmic)
                });
            });
        }

        return traces;
    };

    // Create layout configuration
    const createLayout = (config) => {
        const {
            xAxisName,
            yAxisName,
            isLogarithmic,
            isPanelView,
            showZeroLine,
            showRecessions,
            recessions = [],
            minDate,
            maxDate,
            showXAxis = true
        } = config;

        // Filter recessions to visible range
        const filteredRecessions = showRecessions ? 
            recessions.filter(recession => {
                const recessionStart = new Date(recession.start);
                const recessionEnd = new Date(recession.end);
                return recessionStart <= maxDate && recessionEnd >= minDate;
            }) : [];

        return {
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
                type: 'date',
                tickformat: '%Y-%m-%d',
                tickangle: -45
            },
            yaxis: { 
                title: yAxisName,
                type: isLogarithmic ? 'log' : 'linear',
                tickformat: isLogarithmic ? '.2e' : ',',
                autorange: true,
                showgrid: true,
                gridwidth: 1,
                gridcolor: 'rgba(0,0,0,0.1)'
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
                    bgcolor: 'rgba(255,255,255,0.9)',
                    bordercolor: 'rgba(0,0,0,0.1)',
                    borderwidth: 1
                },
            hovermode: 'closest',
            hoverlabel: {
                namelength: -1,
                bgcolor: 'rgba(255,255,255,0.95)',
                bordercolor: 'rgba(0,0,0,0.1)',
                font: { family: 'Arial', size: 12 }
            },
            shapes: [
                // Recession shapes
                ...filteredRecessions.map(recession => ({
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: recession.start,
                    x1: recession.end,
                    y0: 0,
                    y1: 1,
                    fillcolor: 'rgba(169, 169, 169, 0.4)',
                    line: { width: 0 },
                    layer: 'below'
                })),
                // Zero line if enabled
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
                        dash: 'dash'
                    },
                    layer: 'below'
                }] : [])
            ],
            // Additional layout settings for better visualization
            dragmode: false,
            showlegend: !isPanelView,
            modebar: {
                remove: ['zoom', 'pan', 'select', 'lasso2d']
            },
            annotations: showRecessions ? 
                filteredRecessions.map((recession, index) => ({
                    x: new Date(recession.start),
                    y: 1,
                    xref: 'x',
                    yref: 'paper',
                    text: recession.name || 'Recession',
                    showarrow: false,
                    font: {
                        size: 10,
                        color: 'rgba(0,0,0,0.6)'
                    },
                    yshift: -(index * 20)
                })) : []
        };
    };

    // Error handling utilities
    const errorHandling = {
        validateData: (data) => {
            if (!Array.isArray(data)) {
                throw new Error('Data must be an array');
            }
            if (data.length === 0) {
                throw new Error('Data array cannot be empty');
            }
            return true;
        },

        validateConfig: (config) => {
            if (!config || typeof config !== 'object') {
                throw new Error('Invalid configuration object');
            }
            return true;
        },

        validateContainer: (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container with id "${containerId}" not found`);
            }
            return container;
        }
    };

    return {
        createChart,
        utils,
        calculations,
        technicalIndicators,
        colorUtils,
        processCloudData,
        errorHandling
    };
})();

if (typeof window !== 'undefined') {
    window.PlotlyChartSystem = PlotlyChartSystem;
}