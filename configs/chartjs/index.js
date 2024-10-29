// Create a self-contained chart system
const ChartJsSystem = (function() {
    // Calculation utilities
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
        },
    };

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
                    default: h = 0;
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

        shiftColor: (color, degree) => {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            const hsl = colorUtils.rgbToHsl(r, g, b);
            hsl[0] = (hsl[0] + degree) % 360;
            const rgb = colorUtils.hslToRgb(hsl[0], hsl[1], hsl[2]);
            
            return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
        },

        getStudyColor: (study, baseColor) => {
            switch (study) {
                case 'SMA': return colorUtils.shiftColor(baseColor, 40);
                case 'EMA': return colorUtils.shiftColor(baseColor, 80);
                case 'CAGR': return colorUtils.shiftColor(baseColor, 120);
                case 'RSI': return colorUtils.shiftColor(baseColor, 160);
                default: return baseColor;
            }
        }
    };

    // Chart creation utilities
    const chartUtils = {
        getTableName: (fullName) => {
            const parts = fullName.split('.');
            return parts[parts.length - 1];
        },

        createChartData: (datasets, type) => {
            const chartData = {
                datasets: []
            };

            datasets.forEach(dataset => {
                let processedData = dataset.data;

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

                // Add main dataset
                chartData.datasets.push({
                    label: chartUtils.getTableName(dataset.name),
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
                });

                // Add study lines
                if (dataset.studies) {
                    dataset.studies.forEach(study => {
                        let studyData;
                        switch (study) {
                            case 'SMA':
                                studyData = calculations.calculateSMA(processedData, 20);
                                break;
                            case 'EMA':
                                studyData = calculations.calculateEMA(processedData, 20);
                                break;
                            case 'CAGR':
                                studyData = calculations.calculateCAGR(processedData);
                                break;
                            case 'RSI':
                                studyData = calculations.calculateRSI(processedData);
                                break;
                        }
                        if (studyData) {
                            chartData.datasets.push({
                                label: `${chartUtils.getTableName(dataset.name)} - ${study}`,
                                data: studyData,
                                borderColor: colorUtils.getStudyColor(study, dataset.color),
                                borderWidth: 1,
                                fill: false,
                                pointRadius: 0,
                                pointHoverRadius: 0,
                            });
                        }
                    });
                }
            });

            return chartData;
        },

        createChartOptions: (config) => {
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
                isLastChart = true
            } = config;

            const filteredRecessions = showRecessions ? 
                recessions.filter(recession => {
                    const recessionStart = new Date(recession.start);
                    const recessionEnd = new Date(recession.end);
                    return recessionStart <= maxDate && recessionEnd >= minDate;
                }) : [];

            return {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'yyyy-MM-dd',
                        },
                        title: {
                            display: isLastChart,
                            text: isLastChart ? xAxisName : '',
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
                            callback: function(value) {
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
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString();
                                    const dataset = config.data.find(d => 
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
                        annotations: {
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
                        }
                    }
                },
                maintainAspectRatio: false,
            };
        }
    };

    const processData = (rawData, config) => {
        const { datasets } = config;
        if (!datasets || datasets.length === 0) {
            console.error('No datasets provided in configuration');
            return [];
        }

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

            // Apply any calculations needed
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
            if (dataset.studies && dataset.studies.length > 0) {
                dataset.studies.forEach(study => {
                    const studyData = technicalIndicators[`calculate${study}`](processedData);
                    processedData = studyData;
                });
            }

            return {
                name: dataset.name,
                color: dataset.color || '#1468a8ff',
                data: processedData,
                displayMode: dataset.displayMode,
                studies: dataset.studies || []
            };
        });
    };

    const createChart = (containerId, rawData, cloudConfig) => {
        try {
            const container = document.getElementById(containerId);
            if (!container) throw new Error('Container not found');

            // Initialize Chart.js if not already done
            initializeChart();

            // Process cloud function configuration
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
            const processedData = processData(rawData, cloudConfig);

            // Calculate date range
            const allDates = processedData.flatMap(dataset => 
                dataset.data.map(item => item.x)
            );
            const minDate = new Date(Math.min(...allDates));
            const maxDate = new Date(Math.max(...allDates));

            // Set up container
            container.innerHTML = ''; // Clear existing content

            if (config.isPanelView) {
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';

                // Create individual panels
                const promises = processedData.map((dataset, index) => {
                    return new Promise(resolve => {
                        const panelDiv = document.createElement('canvas');
                        panelDiv.style.flex = '1';
                        panelDiv.style.marginBottom = 
                            index < processedData.length - 1 ? '20px' : '0';
                        container.appendChild(panelDiv);

                        const ctx = panelDiv.getContext('2d');
                        new Chart(ctx, {
                            type: config.type === 'bar' ? 'bar' : 'line',
                            data: chartUtils.createChartData([dataset], config.type),
                            options: chartUtils.createChartOptions({
                                ...config,
                                isLastChart: index === processedData.length - 1,
                                minDate,
                                maxDate
                            })
                        });

                        resolve();
                    });
                });

                // Wait for all charts to render
                Promise.all(promises).then(() => {
                    window.chartRendered = true;
                });
            } else {
                const canvas = document.createElement('canvas');
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                container.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                const chart = new Chart(ctx, {
                    type: config.type === 'bar' ? 'bar' : 'line',
                    data: chartUtils.createChartData(processedData, config.type),
                    options: chartUtils.createChartOptions({
                        ...config,
                        minDate,
                        maxDate,
                        data: processedData
                    })
                });

                // Signal completion
                chart.options.animation.onComplete = () => {
                    window.chartRendered = true;
                };
            }
        } catch (error) {
            console.error('Error creating chart:', error);
            throw error;
        }
    };

    // Initialize Chart.js
    const initializeChart = () => {
        // Only initialize once
        if (window.chartInitialized) return;

        Chart.register(ChartAnnotation);
        
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        
        Chart.defaults.scales.time = {
            adapters: {
                date: {
                    locale: enUS
                }
            }
        };

        window.chartInitialized = true;
    };


    return {
        createChart,
        initializeChart,
        calculations,
        colorUtils,
        chartUtils,
        technicalIndicators
    };
})();

if (typeof window !== 'undefined') {
    window.ChartJsSystem = ChartJsSystem;
}