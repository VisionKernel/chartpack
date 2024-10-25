import { createChartOptions } from './options.js';

export const getChartJsConfig = (series, config = {}) => {
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
    };

    // Merge default config with provided config
    const finalConfig = {
        ...defaultConfig,
        ...config
    };

    return createChartOptions(series, finalConfig);
};

// Export types for TypeScript users
export const ChartTypes = {
    LINE: 'line',
    BAR: 'bar',
    AREA: 'area'
};

export const DisplayModes = {
    NORMAL: 'normal',
    ROC: 'roc',
    GROWTH_OF_100: 'Growth of $100',
    SCALE_0_100: '0-100 Scale'
};

export const StudyTypes = {
    SMA: 'SMA',
    EMA: 'EMA',
    CAGR: 'CAGR',
    RSI: 'RSI'
};