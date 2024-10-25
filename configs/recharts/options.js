// Import shared utilities
import { formatDate, formatNumber } from '../../utils/formatters.js';

// Process data function
const processData = (datasets, config) => {
    const { isLogarithmic } = config;
    
    // Combine all datasets into a single array with named columns
    let combined = datasets.reduce((acc, dataset) => {
        let processedData;
        switch (dataset.displayMode) {
            case 'ROC':
                processedData = calculateRoc(dataset.data);
                break;
            case 'Growth of $100':
                processedData = calculateGrowthOf100(dataset.data);
                break;
            case '0-100 Scale':
                processedData = calculate0To100Scale(dataset.data);
                break;
            default:
                processedData = dataset.data;
        }

        // Add main dataset
        processedData.forEach((dataPoint) => {
            const existingPoint = acc.find(item => item.x === dataPoint.x);
            if (existingPoint) {
                existingPoint[dataset.name.split('.').pop()] = dataPoint.y;
            } else {
                const newPoint = { x: dataPoint.x };
                newPoint[dataset.name.split('.').pop()] = dataPoint.y;
                acc.push(newPoint);
            }
        });

        // Add studies if present
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
                    studyData.forEach((dataPoint) => {
                        const existingPoint = acc.find(item => item.x === dataPoint.x);
                        if (existingPoint) {
                            existingPoint[`${dataset.name.split('.').pop()} - ${study}`] = dataPoint.y;
                        } else {
                            const newPoint = { x: dataPoint.x };
                            newPoint[`${dataset.name.split('.').pop()} - ${study}`] = dataPoint.y;
                            acc.push(newPoint);
                        }
                    });
                }
            });
        }

        return acc;
    }, []);

    // Sort by date
    combined.sort((a, b) => new Date(a.x) - new Date(b.x));

    // Calculate min/max Y values
    const yValues = combined.flatMap(point => 
        Object.values(point).filter(val => typeof val === 'number')
    );
    const minY = Math.min(0, ...yValues);
    const maxY = Math.max(0, ...yValues);

    // Handle logarithmic scale
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

    return { data: combined, minY, maxY };
};

// Create the chart configuration
export const createChartOptions = (series, config) => {
    const {
        type = 'line',
        xAxisName,
        yAxisName,
        isLogarithmic,
        showRecessions,
        recessions = [],
        isPanelView,
        showZeroLine,
        showXAxis = true
    } = config;

    // Process the data
    const { data: chartData, minY, maxY } = processData(series, config);

    // Common chart options
    const commonOptions = {
        width: '100%',
        height: '100%',
        margin: { 
            top: 5, 
            right: 30, 
            left: 20, 
            bottom: showXAxis ? 20 : 5 
        },
        data: chartData,
        cartesianGrid: {
            strokeDasharray: '3 3'
        },
        xAxis: {
            dataKey: 'x',
            type: 'number',
            scale: 'time',
            domain: ['dataMin', 'dataMax'],
            tickFormatter: tick => new Date(tick).getFullYear(),
            hide: !showXAxis,
            label: showXAxis ? {
                value: xAxisName,
                position: 'insideBottomRight',
                offset: -10
            } : null
        },
        yAxis: {
            scale: isLogarithmic ? 'log' : 'linear',
            domain: isLogarithmic ? ['auto', 'auto'] : [minY, maxY],
            tickFormatter: value => isLogarithmic ? 
                value.toExponential(2) : 
                new Intl.NumberFormat('en-US').format(value),
            label: {
                value: yAxisName,
                angle: -90,
                position: 'insideLeft'
            },
            allowDataOverflow: true
        },
        tooltip: {
            formatter: (value, name, props) => {
                const [datasetName, studyName] = name.split(' - ');
                const dataset = series.find(d => 
                    d.name.split('.').pop() === datasetName
                );

                if (studyName) {
                    return value.toFixed(2);
                }

                if (dataset) {
                    switch (dataset.displayMode) {
                        case 'ROC':
                            return `${value.toFixed(2)}%`;
                        case 'Growth of $100':
                            return `$${value.toFixed(2)}`;
                        case '0-100 Scale':
                            return `${value.toFixed(2)} (0-100 scale)`;
                        default:
                            return isLogarithmic ? 
                                value.toExponential(2) : 
                                value.toLocaleString();
                    }
                }

                return isLogarithmic ? 
                    value.toExponential(2) : 
                    value.toLocaleString();
            }
        },
        legend: {
            enabled: !isPanelView
        }
    };

    // Add recession areas if enabled
    if (showRecessions) {
        commonOptions.referenceAreas = recessions.map((recession, index) => ({
            x1: recession.start,
            x2: recession.end,
            fill: 'rgba(169, 169, 169, 0.4)',
            fillOpacity: 0.3
        }));
    }

    // Add zero line if enabled
    if (showZeroLine && !isLogarithmic) {
        commonOptions.referenceLines = [{
            y: 0,
            stroke: 'rgba(0, 0, 0, 0.5)',
            strokeDasharray: '3 3'
        }];
    }

    // Series configuration
    const seriesConfig = series.map(dataset => {
        const baseSeries = {
            dataKey: dataset.name.split('.').pop(),
            name: dataset.name.split('.').pop(),
            color: dataset.color || '#1468a8ff',
            width: dataset.lineWidth || 2
        };

        // Add studies if present
        const studies = dataset.studies ? dataset.studies.map(study => ({
            dataKey: `${dataset.name.split('.').pop()} - ${study}`,
            name: `${dataset.name.split('.').pop()} - ${study}`,
            color: getStudyColor(study, dataset.color || '#1468a8ff'),
            width: 1
        })) : [];

        return [baseSeries, ...studies];
    }).flat();

    return {
        type,
        ...commonOptions,
        series: seriesConfig
    };
};