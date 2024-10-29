// Create a self-contained chart system
const ApexChartsSystem = (function() {
    // Utility functions
    const utils = {
        getTableName: (fullName) => {
            const parts = fullName.split('.');
            return parts[parts.length - 1];
        },

        isValidDate: (dateString) => {
            const date = new Date(dateString);
            return !isNaN(date.getTime());
        },

        formatDate: (value) => {
            return new Date(value).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        },

        formatNumber: (value, isLogarithmic) => {
            if (isLogarithmic) {
                return value.toExponential(2);
            }
            return new Intl.NumberFormat('en-US', { 
                maximumFractionDigits: 2,
                minimumFractionDigits: 0 
            }).format(value);
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
        }
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

    const processSeries = (rawData, config) => {
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
                    if (!point.date || !point.value || 
                        isNaN(point.value) || !utils.isValidDate(point.date)) {
                        console.warn(`Filtering out invalid data point:`, point);
                        return false;
                    }
                    return true;
                })
                .map(point => ({
                    x: new Date(point.date).getTime(),
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
            if (dataset.studies) {
                dataset.studies.forEach(study => {
                    const studyData = technicalIndicators[`calculate${study}`](processedData);
                    processedData = studyData;
                });
            }

            // Filter non-positive values for logarithmic scale
            if (config.displaySettings.isLogarithmic) {
                processedData = processedData.filter(point => point.y > 0);
            }

            return {
                name: dataset.name,
                color: dataset.color,
                data: processedData,
                displayMode: dataset.displayMode
            };
        });
    };

    // Create chart options for single dataset
    const createSingleDatasetOptions = (dataset, config) => {
        const {
            type,
            showRecessions,
            recessions,
            xAxisName,
            isLogarithmic,
            showZeroLine,
            isLastChart = false
        } = config;

        let recessionAnnotations = [];
        if (showRecessions && Array.isArray(recessions) && recessions.length > 0) {
            recessionAnnotations = recessions.map(recession => ({
                x: new Date(recession.start).getTime(),
                x2: new Date(recession.end).getTime(),
                fillColor: '#f3f3f3',
                opacity: 0.5,
                label: {
                    text: '',
                    style: {
                        fontSize: '0px',
                    },
                },
            }));
        }

        return {
            chart: {
                type,
                toolbar: {
                    show: false,
                },
                animations: {
                    enabled: false,
                },
            },
            dataLabels: {
                enabled: false,
            },
            stroke: {
                curve: "straight",
                width: 2,
            },
            colors: [dataset.color],
            tooltip: {
                x: {
                    formatter: utils.formatDate
                },
                y: {
                    formatter: function(value) {
                        let formattedValue;
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
                                formattedValue = utils.formatNumber(value, isLogarithmic);
                        }
                        return `${dataset.name}: ${formattedValue}`;
                    }
                },
            },
            grid: {
                show: true,
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    formatter: utils.formatDate,
                    rotateAlways: false,
                    rotate: -45,
                },
                title: {
                    text: isLastChart ? xAxisName : '',
                },
            },
            yaxis: {
                logarithmic: isLogarithmic,
                logBase: 10,
                title: {
                    text: dataset.name,
                },
                labels: {
                    formatter: value => utils.formatNumber(value, isLogarithmic)
                },
                forceNiceScale: !isLogarithmic,
            },
            annotations: {
                xaxis: recessionAnnotations,
                yaxis: showZeroLine && !isLogarithmic ? [{
                    y: 0,
                    strokeDashArray: 0,
                    borderColor: "#000000",
                    borderWidth: 1,
                    opacity: 1
                }] : [],
            },
            legend: {
                show: false,
            },
        };
    };

    // Create chart options for multiple datasets
    const createMultiDatasetOptions = (datasets, config) => {
        const {
            type,
            showRecessions,
            recessions,
            xAxisName,
            yAxisName,
            isLogarithmic,
            showZeroLine
        } = config;

        let recessionAnnotations = [];
        if (showRecessions && Array.isArray(recessions) && recessions.length > 0) {
            recessionAnnotations = recessions.map(recession => ({
                x: new Date(recession.start).getTime(),
                x2: new Date(recession.end).getTime(),
                fillColor: '#f3f3f3',
                opacity: 0.5,
                label: {
                    text: '',
                    style: {
                        fontSize: '0px',
                    },
                },
            }));
        }

        return {
            chart: {
                type,
                toolbar: {
                    show: false,
                },
                animations: {
                    enabled: false,
                },
            },
            dataLabels: {
                enabled: false,
            },
            stroke: {
                curve: "straight",
                width: datasets.map(s => s.width || 2),
            },
            colors: datasets.map(s => s.color),
            tooltip: {
                shared: true,
                intersect: false,
                x: {
                    formatter: utils.formatDate
                },
                y: {
                    formatter: function(value, { seriesIndex }) {
                        const dataset = datasets[seriesIndex];
                        let formattedValue;
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
                                formattedValue = utils.formatNumber(value, isLogarithmic);
                        }
                        return `${dataset.name}: ${formattedValue}`;
                    }
                },
            },
            grid: {
                show: true,
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    formatter: utils.formatDate,
                    rotateAlways: false,
                    rotate: -45,
                },
                title: {
                    text: xAxisName,
                },
            },
            yaxis: {
                logarithmic: isLogarithmic,
                logBase: 10,
                title: {
                    text: yAxisName,
                },
                labels: {
                    formatter: value => utils.formatNumber(value, isLogarithmic)
                },
                forceNiceScale: !isLogarithmic,
            },
            annotations: {
                xaxis: recessionAnnotations,
                yaxis: showZeroLine && !isLogarithmic ? [{
                    y: 0,
                    strokeDashArray: 0,
                    borderColor: "#000000",
                    borderWidth: 1,
                    opacity: 1
                }] : [],
            },
            legend: {
                show: true,
                position: 'top',
                horizontalAlign: 'left',
                fontSize: '14px',
                fontFamily: 'Helvetica, Arial, sans-serif',
                offsetY: 10,
            },
        };
    };

    const createChart = (containerId, rawData, cloudConfig) => {
        try {
            const container = document.getElementById(containerId);
            if (!container) throw new Error('Container not found');

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

            // Process the series data
            const processedSeries = processSeries(rawData, cloudConfig);

            if (config.isPanelView) {
                // Clear and set up container
                container.innerHTML = '';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';

                // Create individual panels
                const promises = processedSeries.map((dataset, index) => {
                    return new Promise((resolve) => {
                        const panelDiv = document.createElement('div');
                        panelDiv.style.flex = '1';
                        panelDiv.style.height = '200px';
                        panelDiv.style.marginBottom = 
                            index < processedSeries.length - 1 ? '20px' : '0';
                        container.appendChild(panelDiv);

                        const chartOptions = createSingleDatasetOptions(dataset, {
                            ...config,
                            isLastChart: index === processedSeries.length - 1
                        });

                        const chart = new ApexCharts(panelDiv, {
                            ...chartOptions,
                            series: [{ data: dataset.data }]
                        });

                        chart.render().then(resolve);
                    });
                });

                // Wait for all charts to render
                Promise.all(promises).then(() => {
                    window.chartRendered = true;
                });
            } else {
                // Create single chart with multiple datasets
                const chartOptions = createMultiDatasetOptions(processedSeries, config);
                const chart = new ApexCharts(container, {
                    ...chartOptions,
                    series: processedSeries
                });

                chart.render().then(() => {
                    window.chartRendered = true;
                });
            }
        } catch (error) {
            console.error('Error creating chart:', error);
            throw error;
        }
    };

    // Public API
    return {
        createChart,
        utils,
        calculations,
        technicalIndicators
    };
})();

// Make it available globally
if (typeof window !== 'undefined') {
    window.ApexChartsSystem = ApexChartsSystem;
}