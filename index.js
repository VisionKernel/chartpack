// Import all chart configurations
import { getApexConfig } from './configs/apex/index.js';
import { getEchartsConfig } from './configs/echarts/index.js';
import { getPlotlyConfig } from './configs/plotly/index.js';
import { getRechartsConfig } from './configs/recharts/index.js';
import { getChartJsConfig } from './configs/chartjs/index.js';

// Import shared utilities
import { 
    formatDate,
    formatNumber,
    calculateDateRange,
    getColorPalette
} from './utils/formatters.js';

// Shared chart utilities
const chartUtils = {
    formatters: {
        date: formatDate,
        number: formatNumber
    },
    calculations: {
        dateRange: calculateDateRange
    },
    styles: {
        colors: getColorPalette
    }
};

// Export individual chart configurations
export const ChartConfigs = {
    apex: getApexConfig,
    echarts: getEchartsConfig,
    plotly: getPlotlyConfig,
    recharts: getRechartsConfig,
    chartjs: getChartJsConfig
};

// Export utilities
export const utils = chartUtils;

// Export a helper to get config for specific chart type
export const getChartConfig = (chartType, data, options = {}) => {
    const configGetter = ChartConfigs[chartType.toLowerCase()];
    if (!configGetter) {
        throw new Error(`Unsupported chart type: ${chartType}`);
    }
    
    // Apply any global options and get config
    return configGetter(data, {
        ...options,
        utils: chartUtils  // Pass utilities to each config
    });
};

// Export default for ES modules
export default {
    getConfig: getChartConfig,
    utils: chartUtils,
    configs: ChartConfigs
};

// Export version information
export const VERSION = '1.0.0';
export const SUPPORTED_LIBRARIES = Object.keys(ChartConfigs);

// Export type information for TypeScript users
export const ChartTypes = {
    LINE: 'line',
    BAR: 'bar',
    AREA: 'area',
    SCATTER: 'scatter',
    PIE: 'pie'
};

export const DisplayModes = {
    NORMAL: 'normal',
    ROC: 'roc',
    GROWTH_OF_100: 'growthOf100',
    SCALE_0_100: 'scale0To100'
};

// Example usage in comments:
/*
import { getChartConfig } from 'chart-configs';

const config = getChartConfig('apex', data, {
    type: 'line',
    title: 'My Chart',
    xAxis: { title: 'Date' },
    yAxis: { title: 'Value' },
    displayMode: 'normal'
});
*/