# Sentiment Analysis Feature

## Overview

The sentiment analyzer provides automated classification and trend analysis of GDELT tone data, transforming raw numerical sentiment scores into human-readable insights about news coverage patterns.

## How It Works

### Data Source
The analyzer fetches sentiment data from the GDELT DOC 2.0 API using the `TimelineTone` mode, which provides average tone scores over time. According to GDELT documentation:
- Tone scores typically range from **-20 to +20** (full range: -100 to +100)
- Scores between **-1 and +1** indicate neutral/factual coverage
- Negative scores indicate negative tone
- Positive scores indicate positive tone

### Classifications

#### Overall Sentiment Classification
Based on the average tone across the time period:

| Average Tone | Classification |
|--------------|----------------|
| ≥ 5          | Highly Positive |
| 2 to 5       | Moderately Positive |
| -1 to 2      | Neutral |
| -5 to -1     | Moderately Negative |
| < -5         | Highly Negative |

#### Trend Direction
Using linear regression analysis, the system identifies sentiment trends:

- **Increasingly Positive**: Strong upward trend (slope > 0.05)
- **Slightly Improving**: Weak upward trend (0 < slope ≤ 0.05)
- **Stable**: Minimal change (|slope| < 0.01)
- **Slightly Declining**: Weak downward trend (-0.05 ≤ slope < 0)
- **Increasingly Negative**: Strong downward trend (slope < -0.05)

The analyzer provides both:
- **Overall trend**: Across the entire time period
- **Recent trend**: Based on the most recent 20% of data points

#### Volatility Classification
Measured using standard deviation of tone values:

| Std. Deviation | Classification |
|----------------|----------------|
| < 1            | Very Stable |
| 1 to 2         | Stable |
| 2 to 3         | Moderate |
| 3 to 5         | Volatile |
| > 5            | Highly Volatile |

Volatility indicates how much sentiment fluctuates over time:
- **Low volatility**: Consistent tone across coverage
- **High volatility**: Dramatic swings between positive and negative coverage

## Usage

### In the Web Interface

1. Select your search parameters (resource, region, country, or custom search)
2. Choose a timespan for sentiment analysis (1Y, 2Y, or 5Y)
3. Click the **📊 Analyze** button in the Sentiment section
4. View the analysis popup with comprehensive results

### Programmatic Usage

```javascript
// Analyze sentiment for a query
const analysis = await window.analyzeSentiment('petroleum', '1y');

if (analysis.success) {
  console.log('Classification:', analysis.classification.overall);
  console.log('Overall Trend:', analysis.trend.overall);
  console.log('Recent Trend:', analysis.trend.recent);
  console.log('Volatility:', analysis.classification.volatility);
  console.log('Average Tone:', analysis.statistics.average);
}

// Show analysis popup
window.showSentimentAnalysis('petroleum', '1y', buttonElement);
```

## Analysis Results

The analyzer provides:

### Statistics
- **Average tone**: Mean of all tone values
- **Minimum/Maximum**: Range of tone values observed
- **Volatility**: Standard deviation of tone values

### Classifications
- **Overall sentiment**: Category based on average tone
- **Volatility level**: How stable/volatile the coverage is

### Trends
- **Overall trend**: Direction across entire time period
- **Recent trend**: Direction of most recent data
- **Slope values**: Numerical measure of trend strength

### Raw Data
- **Date array**: Timestamps for each data point
- **Tone array**: Raw tone values for further analysis

## Example Interpretations

### Example 1: Oil Industry Coverage
```
Classification: Moderately Negative (avg: -3.2)
Overall Trend: increasingly negative
Recent Trend: stable
Volatility: moderate (σ = 2.4)
```
**Interpretation**: Oil industry coverage has been moderately negative and has been getting more negative over the year. However, recent sentiment has stabilized, suggesting the narrative may have reached a steady state. Moderate volatility indicates occasional swings in tone.

### Example 2: Renewable Energy Coverage
```
Classification: Moderately Positive (avg: 2.8)
Overall Trend: increasingly positive
Recent Trend: increasingly positive
Volatility: stable (σ = 1.5)
```
**Interpretation**: Renewable energy coverage is positive and improving consistently. The stable volatility suggests consistent, favorable coverage without dramatic swings.

### Example 3: Political Event Coverage
```
Classification: Neutral (avg: -0.5)
Overall Trend: stable
Recent Trend: slightly declining
Volatility: highly volatile (σ = 6.2)
```
**Interpretation**: While average coverage is neutral, high volatility indicates dramatic swings between very positive and very negative coverage. Recent slight decline suggests the most recent coverage has been slightly more negative.

## Technical Details

### Statistical Methods

#### Linear Regression for Trend Detection
```
Given n data points (x₀, y₀), (x₁, y₁), ..., (xₙ₋₁, yₙ₋₁)
where x = time index, y = tone value

Slope = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)
```

#### Volatility Calculation
```
Standard Deviation = √(Σ(xᵢ - μ)² / n)
where μ = mean tone value
```

### API Integration

The analyzer fetches JSON data from GDELT:
```
https://api.gdeltproject.org/api/v2/doc/doc?
  query=[search_terms]
  &mode=TimelineTone
  &timespan=[1y|2y|5y]
  &format=json
```

Response structure:
```json
{
  "timeline": [
    {
      "date": "20231201000000",
      "tone": -2.5,
      "volume": 150
    },
    ...
  ]
}
```

## Limitations

1. **Data Availability**: Analysis requires sufficient data points (minimum 2)
2. **GDELT Limitations**: 
   - Historical data limited to what GDELT has indexed
   - Tone is automatically calculated and may not reflect human judgment
   - Coverage gaps in certain regions/languages affect analysis
3. **Trend Interpretation**: 
   - Linear regression assumes trends are linear
   - Complex patterns (cycles, sudden shifts) may not be captured
4. **Volatility Context**: 
   - High volatility can indicate either inconsistent coverage or a genuinely evolving story
   - Must be interpreted in context of the topic

## Future Enhancements

Potential improvements to consider:

- **Moving averages**: Smooth out short-term noise
- **Cycle detection**: Identify recurring patterns
- **Event detection**: Highlight sudden sentiment shifts
- **Comparative analysis**: Compare multiple queries side-by-side
- **Export functionality**: Download analysis results as CSV/JSON
- **Historical comparison**: Compare current vs. past time periods
- **Geographical breakdown**: Analyze sentiment by source country
- **Language breakdown**: Compare sentiment across languages

## References

- [GDELT DOC 2.0 API Documentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
- GDELT Tone Calculation: Based on linguistic analysis of article text
- Timeline modes: TimelineTone, ToneChart for different visualization approaches
