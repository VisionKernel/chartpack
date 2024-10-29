// Create a self-contained chart system
const EChartsSystem = (function() {
    // Utility functions
    const utils = {
        getTableName: (fullName) => {
            const parts = fullName.split('.');
            return parts[parts.length - 1];
        },

        formatDate: (date) => {
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },

        formatYear: (date) => {
            return new Date(date).getFullYear();
        },

        formatValue: (value, displayMode, isLogarithmic) => {
            if (value == null) return 'N/A';
            switch (displayMode) {
                case 'ROC':
                    return value.toFixed(2) + '%';
                case 'Growth of $100':
                    return '$' + value.toFixed(2);
                case '0-100 Scale':
                    return value.toFixed(2) + ' (0-100 scale)';
                default:
                    return isLogarithmic ? 
                        value.toExponential(2) : 
                        value.toLocaleString();
            }
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

            // Apply studies if present
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

    // Create series for the chart
    const createSeries = (datasets, allDates, type, showRecessions, recessions) => {
        let seriesList = [];
        datasets.forEach(dataset => {
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

            // Main dataset series
            seriesList.push({
                name: utils.getTableName(dataset.name),
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
                        utils.formatDate(item.x) === date
                    );
                    return point ? point.y : null;
                }),
                markArea: showRecessions ? {
                    itemStyle: { color: 'rgba(169, 169, 169, 0.4)' },
                    data: recessions.map(recession => [{
                        xAxis: utils.formatDate(recession.start)
                    }, {
                        xAxis: utils.formatDate(recession.end)
                    }])
                } : undefined
            });

            // Study lines
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
                        seriesList.push({
                            name: `${utils.getTableName(dataset.name)} - ${study}`,
                            type: 'line',
                            smooth: true,
                            lineStyle: {
                                color: colorUtils.getStudyColor(study, dataset.color || '#1468a8ff'),
                                width: 1
                            },
                            data: allDates.map(date => {
                                const point = studyData.find(item => 
                                    utils.formatDate(item.x) === date
                                );
                                return point ? point.y : null;
                            })
                        });
                    }
                });
            }
        });
        return seriesList;
    };

    // Create chart options
    const createOptions = (config) => {
        const {
            datasets,
            type,
            xAxisName,
            yAxisName,
            isLogarithmic,
            showRecessions,
            recessions,
            showZeroLine,
            showLegend = true,
            showXAxisLabel = true
        } = config;

        const allDates = [...new Set(datasets.flatMap(dataset => 
            dataset.data.map(item => utils.formatDate(item.x))
        ))].sort();

        return {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const date = params[0].axisValue;
                    let result = `${date}<br/>`;
                    params.forEach(param => {
                        if (param.value != null) {
                            const dataset = datasets.find(d => 
                                utils.getTableName(d.name) === param.seriesName.split(' - ')[0]
                            );
                            result += `${param.seriesName}: ${utils.formatValue(param.value, dataset?.displayMode, isLogarithmic)}<br/>`;
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
                    formatter: utils.formatYear,
                    interval: 'auto',
                    rotate: 45,
                    show: showXAxisLabel
                },
                splitLine: {
                    show: true,
                    lineStyle: { type: 'dashed', color: '#ddd' }
                }
            },
            yAxis: {
                type: isLogarithmic ? 'log' : 'value',
                name: yAxisName,
                nameTextStyle: { fontWeight: 'bold' },
                axisLabel: {
                    formatter: (value) => utils.formatValue(value, datasets[0]?.displayMode, isLogarithmic)
                },
                splitLine: {
                    show: true,
                    lineStyle: { type: 'dashed', color: '#ddd' }
                },
                logBase: 10
            },
            series: [
                ...createSeries(datasets, allDates, type, showRecessions, recessions),
                ...(showZeroLine && !isLogarithmic ? [{
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
                }] : [])
            ],
            legend: {
                show: showLegend,
                data: createSeries(datasets, allDates, type, showRecessions, recessions)
                    .map(series => series.name)
            }
        };
    };

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

            // Get all dates for x-axis
            const allDates = [...new Set(processedData.flatMap(dataset => 
                dataset.data.map(point => utils.formatDate(point.x))
            ))].sort();

            // Create charts based on panel view setting
            if (config.isPanelView) {
                // Clear and set up container
                container.innerHTML = '';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';

                // Create individual panels
                const charts = processedData.map((dataset, index) => {
                    const panelDiv = document.createElement('div');
                    panelDiv.style.flex = '1';
                    panelDiv.style.marginBottom = 
                        index < processedData.length - 1 ? '20px' : '0';
                    panelDiv.style.width = '100%';
                    panelDiv.style.height = '100%';
                    container.appendChild(panelDiv);

                    const chart = echarts.init(panelDiv);
                    const panelConfig = {
                        ...config,
                        datasets: [dataset],
                        showLegend: false,
                        showXAxisLabel: index === processedData.length - 1,
                        allDates
                    };

                    chart.setOption(createOptions(panelConfig));

                    // Handle resize
                    const resizeObserver = new ResizeObserver(() => {
                        chart.resize();
                    });
                    resizeObserver.observe(panelDiv);

                    return chart;
                });

                // Wait for all charts to render
                Promise.all(charts.map(chart => 
                    new Promise(resolve => {
                        chart.on('rendered', resolve);
                    })
                )).then(() => {
                    window.chartRendered = true;
                });
            } else {
                // Create single chart
                const chart = echarts.init(container);
                const chartConfig = {
                    ...config,
                    datasets: processedData,
                    allDates
                };

                chart.setOption(createOptions(chartConfig));

                // Handle resize
                const resizeObserver = new ResizeObserver(() => {
                    chart.resize();
                });
                resizeObserver.observe(container);

                // Handle rendering completion
                chart.on('rendered', () => {
                    window.chartRendered = true;
                });
            }
        } catch (error) {
            console.error('Error creating chart:', error);
            throw error;
        }
    };

    return {
        createChart,
        utils,
        calculations,
        colorUtils,
        technicalIndicators
    };
})();

if (typeof window !== 'undefined') {
    window.EChartsSystem = EChartsSystem;
}