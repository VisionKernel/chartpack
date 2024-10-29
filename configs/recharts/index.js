// Create a self-contained chart system
const RechartsSystem = (function() {
    // Utility functions
    const utils = {
        getTableName: (fullName) => {
            const parts = fullName.split('.');
            return parts[parts.length - 1];
        },

        formatNumber: (value, isLogarithmic) => {
            if (isLogarithmic) return value.toExponential(2);
            return new Intl.NumberFormat('en-US').format(value);
        },

        formatDate: (date) => {
            return new Date(date).getFullYear();
        }
    };

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

        getStudyColor: (study, baseColor) => {
            const shiftColor = (color, degree) => {
                const hex = color.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                
                const hsl = colorUtils.rgbToHsl(r, g, b);
                hsl[0] = (hsl[0] + degree) % 360;
                const rgb = colorUtils.hslToRgb(hsl[0], hsl[1], hsl[2]);
                
                return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
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

    // Data processing function
    const processData = (datasets, isLogarithmic) => {
        let combined = datasets.reduce((acc, dataset) => {
            let processedData;
            switch (dataset.displayMode) {
                case 'ROC':
                    processedData = calculations.calculateRoc(dataset.data);
                    break;
                case 'Growth of $100':
                    processedData = calculations.calculateGrowthOf100(dataset.data);
                    break;
                case '0-100 Scale':
                    processedData = calculations.calculate0To100Scale(dataset.data);
                    break;
                default:
                    processedData = dataset.data;
            }

            processedData.forEach((dataPoint) => {
                const existingPoint = acc.find(item => item.x === dataPoint.x);
                if (existingPoint) {
                    existingPoint[utils.getTableName(dataset.name)] = dataPoint.y;
                } else {
                    const newPoint = { x: dataPoint.x };
                    newPoint[utils.getTableName(dataset.name)] = dataPoint.y;
                    acc.push(newPoint);
                }
            });

            // Process studies
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
                        studyData.forEach((dataPoint) => {
                            const existingPoint = acc.find(item => item.x === dataPoint.x);
                            if (existingPoint) {
                                existingPoint[`${utils.getTableName(dataset.name)} - ${study}`] = dataPoint.y;
                            } else {
                                const newPoint = { x: dataPoint.x };
                                newPoint[`${utils.getTableName(dataset.name)} - ${study}`] = dataPoint.y;
                                acc.push(newPoint);
                            }
                        });
                    }
                });
            }

            return acc;
        }, []);

        combined.sort((a, b) => new Date(a.x) - new Date(b.x));

        const yValues = combined.flatMap(point => 
            Object.values(point).filter(val => typeof val === 'number')
        );
        const min = Math.min(0, ...yValues);
        const max = Math.max(0, ...yValues);

        if (isLogarithmic) {
            combined = combined.map(point => {
                const newPoint = { x: point.x };
                Object.keys(point).forEach(key => {
                    if (key !== 'x' && point[key] > 0) {
                        newPoint[key] = point[key];
                    }
                });
                return newPoint;
            });
        }

        return { combinedData: combined, minY: min, maxY: max };
    };

    // Create custom tooltip HTML
    const createTooltip = (datasets, isLogarithmic) => {
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'recharts-custom-tooltip';
        tooltipContainer.style.cssText = `
            background-color: white;
            padding: 10px;
            border: 1px solid #ccc;
            display: none;
            position: absolute;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(tooltipContainer);

        return (point, activeDataKeys) => {
            if (!point || !activeDataKeys.length) {
                tooltipContainer.style.display = 'none';
                return;
            }

            tooltipContainer.innerHTML = `
                <p>Date: ${new Date(point.x).toLocaleDateString()}</p>
                ${activeDataKeys.map(key => {
                    const [datasetName, studyName] = key.split(' - ');
                    const dataset = datasets.find(d => utils.getTableName(d.name) === datasetName);
                    let value = point[key];
                    let formattedValue;

                    if (studyName) {
                        formattedValue = value.toFixed(2);
                    } else if (dataset) {
                        switch (dataset.displayMode) {
                            case 'ROC':
                                formattedValue = `${value.toFixed(2)}%`;
                                break;
                            case 'Growth of $100':
                                formattedValue = `$${value.toFixed(2)}`;
                                break;
                            case '0-100 Scale':
                                formattedValue = `${value.toFixed(2)} (0-100 scale)`;
                                break;
                            default:
                                formattedValue = isLogarithmic ? value.toExponential(2) : value.toLocaleString();
                        }
                    } else {
                        formattedValue = isLogarithmic ? value.toExponential(2) : value.toLocaleString();
                    }

                    return `<p style="color: ${dataset?.color || '#1468a8'}">${key}: ${formattedValue}</p>`;
                }).join('')}
            `;

            tooltipContainer.style.display = 'block';

            // Position tooltip near mouse
            const mouseEvent = window.event;
            if (mouseEvent) {
                const x = mouseEvent.clientX + 10;
                const y = mouseEvent.clientY + 10;
                tooltipContainer.style.left = `${x}px`;
                tooltipContainer.style.top = `${y}px`;
            }
        };
    };

    const processCloudData = (rawData, cloudConfig) => {
        const { datasets } = cloudConfig;
        let combinedData = [];

        datasets.forEach(dataset => {
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

            // Merge into combined data
            processedData.forEach(point => {
                const existingPoint = combinedData.find(p => 
                    p.x.getTime() === point.x.getTime()
                );
                if (existingPoint) {
                    existingPoint[dataset.name] = point.y;
                } else {
                    const newPoint = { x: point.x };
                    newPoint[dataset.name] = point.y;
                    combinedData.push(newPoint);
                }
            });

            // Apply studies if present
            if (dataset.studies) {
                dataset.studies.forEach(study => {
                    const studyData = technicalIndicators[`calculate${study}`](processedData);
                    studyData.forEach(point => {
                        const existingPoint = combinedData.find(p => 
                            p.x.getTime() === point.x.getTime()
                        );
                        if (existingPoint) {
                            existingPoint[`${dataset.name} - ${study}`] = point.y;
                        } else {
                            const newPoint = { x: point.x };
                            newPoint[`${dataset.name} - ${study}`] = point.y;
                            combinedData.push(newPoint);
                        }
                    });
                });
            }
        });

        // Sort combined data
        combinedData.sort((a, b) => a.x - b.x);

        // Handle logarithmic scale
        if (cloudConfig.displaySettings.isLogarithmic) {
            combinedData = combinedData.map(point => {
                const newPoint = { x: point.x };
                Object.entries(point).forEach(([key, value]) => {
                    if (key !== 'x' && value > 0) {
                        newPoint[key] = value;
                    }
                });
                return newPoint;
            });
        }

        // Calculate y-axis range
        const yValues = combinedData.flatMap(point => 
            Object.entries(point)
                .filter(([key]) => key !== 'x')
                .map(([_, value]) => value)
        );
        const minY = Math.min(0, ...yValues);
        const maxY = Math.max(0, ...yValues);

        return { combinedData, minY, maxY };
    };

    // Create chart with cloud function config
    const createChart = (containerId, rawData, cloudConfig) => {
        try {
            const container = document.getElementById(containerId);
            if (!container) throw new Error('Container not found');

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

            // Process data
            const { combinedData, minY, maxY } = processCloudData(rawData, cloudConfig);

            // Clear container
            container.innerHTML = '';

            if (config.isPanelView) {
                // Create panel view
                cloudConfig.datasets.forEach((dataset, index) => {
                    const panelDiv = document.createElement('div');
                    panelDiv.style.flex = '1';
                    panelDiv.style.height = '200px';
                    panelDiv.style.marginBottom = 
                        index < cloudConfig.datasets.length - 1 ? '20px' : '0';
                    container.appendChild(panelDiv);

                    const panelData = combinedData.map(point => ({
                        x: point.x,
                        [dataset.name]: point[dataset.name],
                        ...(dataset.studies || []).reduce((acc, study) => ({
                            ...acc,
                            [`${dataset.name} - ${study}`]: point[`${dataset.name} - ${study}`]
                        }), {})
                    }));

                    // Create individual chart
                    new Recharts.LineChart({
                        container: panelDiv,
                        data: panelData,
                        xAxis: createXAxis(config),
                        yAxis: createYAxis(config, minY, maxY),
                        series: createSeries([dataset], config),
                        tooltip: createTooltip([dataset], config)
                    });
                });
            } else {
                // Create single chart
                new Recharts.LineChart({
                    container,
                    data: combinedData,
                    xAxis: createXAxis(config),
                    yAxis: createYAxis(config, minY, maxY),
                    series: createSeries(cloudConfig.datasets, config),
                    tooltip: createTooltip(cloudConfig.datasets, config)
                });
            }

            // Signal rendering complete
            window.chartRendered = true;

        } catch (error) {
            console.error('Error creating chart:', error);
            throw error;
        }
    };

    // Helper functions for chart creation
    const createXAxis = (config) => ({
        type: 'number',
        dataKey: 'x',
        domain: ['dataMin', 'dataMax'],
        tickFormatter: utils.formatDate,
        label: { value: config.xAxisName, position: 'bottom' }
    });

    const createYAxis = (config, minY, maxY) => ({
        type: config.isLogarithmic ? 'log' : 'linear',
        domain: [minY, maxY],
        tickFormatter: value => utils.formatNumber(value, config.isLogarithmic),
        label: { value: config.yAxisName, angle: -90 }
    });

    const createSeries = (datasets, config) => 
        datasets.map(dataset => ({
            dataKey: dataset.name,
            type: config.type,
            stroke: dataset.color || '#1468a8',
            fill: config.type === 'area' ? 
                `${dataset.color || '#1468a8'}80` : 'none',
            strokeWidth: dataset.lineWidth || 2
        }));

        return {
            createChart,
            utils,
            calculations,
            colorUtils,
            technicalIndicators
        };
    })();
    
    if (typeof window !== 'undefined') {
        window.RechartsSystem = RechartsSystem;
    }