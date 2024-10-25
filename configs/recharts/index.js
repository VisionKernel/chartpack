import { createChartOptions } from './options.js';

export const getRechartsConfig = (series, config = {}) => {
    // Validate required parameters
    if (!series) throw new Error('Series data is required');
    if (!Array.isArray(series)) throw new Error('Series must be an array');

    // Default configuration
    const defaultConfig = {
        type: 'line',
        isLogarithmic: false,
        isPanelView: false,
        showZeroLine: true,
        showRecessions: false,
        recessions: [],
        xAxisName: '',
        yAxisName: '',
        showXAxis: true
    };

    // Merge default config with provided config
    const finalConfig = {
        ...defaultConfig,
        ...config
    };

    // Generate the complete chart configuration
    return createChartOptions(series, finalConfig);
};

// Export chart types
export const ChartTypes = {
    LINE: 'line',
    BAR: 'bar',
    AREA: 'area'
};

// Export display modes
export const DisplayModes = {
    NORMAL: 'normal',
    ROC: 'roc',
    GROWTH_OF_100: 'Growth of $100',
    SCALE_0_100: '0-100 Scale'
};

// Export study types
export const StudyTypes = {
    SMA: 'SMA',
    EMA: 'EMA',
    CAGR: 'CAGR',
    RSI: 'RSI'
};

// Export helpers
export const helpers = {
    processData,
    getStudyColor,
    calculateRoc,
    calculateGrowthOf100,
    calculate0To100Scale
};