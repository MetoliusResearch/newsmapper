/**
 * Sentiment Analyzer for GDELT Tone Data
 * Fetches tone timeline data and provides classification and trend analysis
 */

export function setupSentimentAnalyzer() {
  /**
   * Classify average tone into a sentiment category
   * Based on GDELT documentation: tone typically ranges from -20 to +20
   * Articles in -1 to +1 are neutral/factual
   */
  function classifyTone(avgTone) {
    if (avgTone >= 5) return 'Highly Positive';
    if (avgTone >= 2) return 'Moderately Positive';
    if (avgTone >= -1) return 'Neutral';
    if (avgTone >= -5) return 'Moderately Negative';
    return 'Highly Negative';
  }

  /**
   * Calculate trend direction from tone values
   * Uses linear regression to determine if sentiment is improving or declining
   */
  function calculateTrend(toneValues) {
    if (!toneValues || toneValues.length < 2) return { direction: 'insufficient data', slope: 0 };

    const n = toneValues.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += toneValues[i];
      sumXY += i * toneValues[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    let direction;
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (slope > 0.05) {
      direction = 'increasingly positive';
    } else if (slope > 0) {
      direction = 'slightly improving';
    } else if (slope < -0.05) {
      direction = 'increasingly negative';
    } else {
      direction = 'slightly declining';
    }

    return { direction, slope };
  }

  /**
   * Calculate volatility (standard deviation) of tone values
   */
  function calculateVolatility(toneValues) {
    if (!toneValues || toneValues.length < 2) return 0;

    const avg = toneValues.reduce((sum, val) => sum + val, 0) / toneValues.length;
    const variance =
      toneValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / toneValues.length;
    return Math.sqrt(variance);
  }

  /**
   * Classify volatility level
   */
  function classifyVolatility(volatility) {
    if (volatility < 1) return 'very stable';
    if (volatility < 2) return 'stable';
    if (volatility < 3) return 'moderate';
    if (volatility < 5) return 'volatile';
    return 'highly volatile';
  }

  /**
   * Fetch sentiment data from GDELT API in CSV format
   * Returns the tone timeline data for analysis
   */
  async function fetchSentimentData(query, timespan) {
    try {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=TimelineTone&timespan=${timespan}&format=csv`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      return csvText;
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
      return null;
    }
  }

  /**
   * Parse GDELT CSV timeline data and extract tone values
   * CSV format: Date,Series,Value
   * Example: 2024-12-03,Average Tone,-0.5114
   */
  function parseToneData(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      return { dates: [], tones: [] };
    }

    const dates = [];
    const tones = [];

    // Split into lines and skip header
    const lines = csvText.trim().split('\n');
    
    // Skip header row (Date,Series,Value)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV format: Date,Series,Value
      // We want columns 0 (date) and 2 (value/tone)
      const parts = line.split(',');
      if (parts.length >= 3) {
        const date = parts[0].trim();
        const tone = parseFloat(parts[2].trim());
        
        if (date && !isNaN(tone)) {
          dates.push(date);
          tones.push(tone);
        }
      }
    }

    return { dates, tones };
  }

  /**
   * Generate a comprehensive sentiment analysis
   */
  async function analyzeSentiment(query, timespan) {
    const data = await fetchSentimentData(query, timespan);
    if (!data) {
      return {
        success: false,
        error: 'Failed to fetch sentiment data',
      };
    }

    const { dates, tones } = parseToneData(data);

    if (tones.length === 0) {
      return {
        success: false,
        error: 'No sentiment data available for this query',
      };
    }

    // Calculate statistics
    const avgTone = tones.reduce((sum, val) => sum + val, 0) / tones.length;
    const minTone = Math.min(...tones);
    const maxTone = Math.max(...tones);
    const volatility = calculateVolatility(tones);
    const trend = calculateTrend(tones);

    // Generate classifications
    const classification = classifyTone(avgTone);
    const volatilityClass = classifyVolatility(volatility);

    // Calculate most recent trend (last 20% of data)
    const recentCount = Math.max(2, Math.floor(tones.length * 0.2));
    const recentTones = tones.slice(-recentCount);
    const recentTrend = calculateTrend(recentTones);

    return {
      success: true,
      dataPoints: tones.length,
      timespan: timespan,
      statistics: {
        average: avgTone.toFixed(2),
        minimum: minTone.toFixed(2),
        maximum: maxTone.toFixed(2),
        volatility: volatility.toFixed(2),
      },
      classification: {
        overall: classification,
        volatility: volatilityClass,
      },
      trend: {
        overall: trend.direction,
        overallSlope: trend.slope.toFixed(4),
        recent: recentTrend.direction,
        recentSlope: recentTrend.slope.toFixed(4),
      },
      rawData: {
        dates,
        tones,
      },
    };
  }

  /**
   * Format analysis results as human-readable text
   */
  function formatAnalysis(analysis) {
    if (!analysis.success) {
      return `<div class="sentiment-analysis-error">${analysis.error}</div>`;
    }

    const { statistics, classification, trend, dataPoints } = analysis;

    return `
      <div class="sentiment-analysis-results">
        <h4 style="margin: 0 0 0.5em 0; color: #0c1b50;">Sentiment Analysis</h4>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Classification:</strong> ${classification.overall}
          <br><small style="color: #666;">(Average tone: ${statistics.average})</small>
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Overall Trend:</strong> Coverage is <em>${trend.overall}</em> over the time period
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Recent Trend:</strong> Most recent sentiment is <em>${trend.recent}</em>
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Volatility:</strong> Coverage tone is <em>${classification.volatility}</em>
          <br><small style="color: #666;">(Std. deviation: ${statistics.volatility})</small>
        </div>
        
        <div style="padding-top: 0.5em; border-top: 1px solid #e0e0e0; font-size: 0.9em; color: #666;">
          Analysis based on ${dataPoints} data points
          <br>Range: ${statistics.minimum} to ${statistics.maximum}
        </div>
      </div>
    `;
  }

  /**
   * Display sentiment analysis in a popup
   */
  function showAnalysisPopup(analysis, buttonElement) {
    // Remove any existing popups
    document.querySelectorAll('.sentiment-analysis-popup').forEach((el) => el.remove());

    const popup = document.createElement('div');
    popup.className = 'sentiment-analysis-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: white;
      border: 1px solid #bbb;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 1.2em;
      border-radius: 8px;
      max-width: 420px;
      font-size: 0.95em;
      line-height: 1.5;
    `;

    popup.innerHTML = `
      ${formatAnalysis(analysis)}
      <div style="text-align: right; margin-top: 1em; padding-top: 0.8em; border-top: 1px solid #e0e0e0;">
        <button onclick="this.parentElement.parentElement.remove()" 
                style="padding: 0.4em 1.2em; cursor: pointer; background: #0c1b50; color: white; border: none; border-radius: 4px; font-size: 0.95em;">
          Close
        </button>
      </div>
    `;

    // Position near the button
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      popup.style.left = rect.right + 12 + 'px';
      popup.style.top = rect.top - 8 + 'px';

      // Adjust if off-screen
      document.body.appendChild(popup);
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth) {
        popup.style.left = rect.left - popupRect.width - 12 + 'px';
      }
      if (popupRect.bottom > window.innerHeight) {
        popup.style.top = window.innerHeight - popupRect.height - 20 + 'px';
      }
    } else {
      // Center on screen
      popup.style.left = '50%';
      popup.style.top = '30%';
      popup.style.transform = 'translate(-50%, 0)';
      document.body.appendChild(popup);
    }
  }

  /**
   * Setup analyze button handler
   */
  function setupAnalyzeButton() {
    const analyzeBtn = document.getElementById('sentimentAnalyzeBtn');
    if (!analyzeBtn) return;

    // Remove any existing listeners
    const newBtn = analyzeBtn.cloneNode(true);
    analyzeBtn.parentNode.replaceChild(newBtn, analyzeBtn);

    newBtn.addEventListener('click', async function (e) {
      e.preventDefault();

      // Show loading state
      const originalText = newBtn.textContent;
      newBtn.disabled = true;
      newBtn.textContent = '⏳ Analyzing...';

      try {
        // Get current query and timespan
        const query = window.buildQuery ? window.buildQuery() : 'petroleum OR lng';
        const timespan = window._gdeltTimespanSentiment || '1y';

        const analysis = await analyzeSentiment(query, timespan);
        showAnalysisPopup(analysis, newBtn);
      } catch (error) {
        console.error('Analysis error:', error);
        showAnalysisPopup(
          {
            success: false,
            error: 'An error occurred while analyzing sentiment data',
          },
          newBtn
        );
      } finally {
        // Restore button state
        newBtn.disabled = false;
        newBtn.textContent = originalText;
      }
    });
  }

  // Initialize - setup button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAnalyzeButton);
  } else {
    setupAnalyzeButton();
  }

  // Export functions for external use
  window.analyzeSentiment = analyzeSentiment;
  window.showSentimentAnalysis = function (query, timespan, buttonElement) {
    analyzeSentiment(query, timespan).then((analysis) => {
      showAnalysisPopup(analysis, buttonElement);
    });
  };
}
