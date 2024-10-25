// Date formatting utility
export const formatDate = (date, format = 'MMM dd, yyyy') => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Number formatting utility
export const formatNumber = (number, options = {}) => {
    const {
        decimals = 2,
        prefix = '',
        suffix = '',
        isPercentage = false,
        isLogarithmic = false
    } = options;

    if (isLogarithmic) {
        return number.toExponential(decimals);
    }

    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        style: isPercentage ? 'percent' : 'decimal'
    }).format(isPercentage ? number / 100 : number);

    return `${prefix}${formatted}${suffix}`;
};

// Calculate date range for charts
export const calculateDateRange = (data) => {
    const dates = data.map(d => new Date(d.x || d.date));
    return {
        min: new Date(Math.min(...dates)),
        max: new Date(Math.max(...dates))
    };
};

// Color palette utility
export const getColorPalette = (theme = 'default') => {
    const palettes = {
        default: [
            '#2E93fA', '#66DA26', '#546E7A', '#E91E63', '#FF9800'
        ],
        monochrome: [
            '#008FFB', '#1A6FB5', '#2D4E6F', '#3B3B3B', '#1A1A1A'
        ],
        gradient: [
            '#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0'
        ]
    };

    return palettes[theme] || palettes.default;
};