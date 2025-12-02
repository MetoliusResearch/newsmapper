/**
 * Sentiment Analyzer for GDELT Tone Data
 * Fetches tone timeline data and provides classification and trend analysis
 */

export function setupSentimentAnalyzer() {
  /**
   * Classify average tone into a sentiment category
   * Based on GDELT tone data: values can range from -10 to +10
   * In practice, -5 is incredibly negative, -2 is very negative
   */
  function classifyTone(avgTone) {
    if (avgTone >= 3) return 'Highly Positive';
    if (avgTone >= 1) return 'Moderately Positive';
    if (avgTone >= -1) return 'Neutral/Mixed';
    if (avgTone >= -3) return 'Moderately Negative';
    if (avgTone >= -5) return 'Highly Negative';
    return 'Extremely Negative';
  }

  /**
   * Calculate trend direction from tone values
   * Uses linear regression with statistical significance testing
   */
  function calculateTrend(toneValues) {
    if (!toneValues || toneValues.length < 2) return { direction: 'insufficient data', slope: 0, rSquared: 0 };

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
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared to measure trend strength
    const meanY = sumY / n;
    let ssTotal = 0;
    let ssResidual = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssTotal += Math.pow(toneValues[i] - meanY, 2);
      ssResidual += Math.pow(toneValues[i] - predicted, 2);
    }
    
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    
    // Determine direction based on slope magnitude and R-squared
    let direction;
    const absSlope = Math.abs(slope);
    
    // Only consider it a real trend if R-squared is reasonable
    if (rSquared < 0.1 || absSlope < 0.005) {
      direction = 'stable/no clear trend';
    } else if (slope > 0.02) {
      direction = 'increasingly positive';
    } else if (slope > 0.005) {
      direction = 'slightly improving';
    } else if (slope < -0.02) {
      direction = 'increasingly negative';
    } else {
      direction = 'slightly declining';
    }

    return { direction, slope, rSquared, intercept };
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
   * Uses TimelineVol mode to get volume distribution across tone buckets
   */
  async function fetchSentimentData(query, timespan) {
    try {
      // GDELT requires OR terms to be wrapped in parentheses
      let formattedQuery = query;
      if (query.includes(' OR ') && !query.startsWith('(')) {
        formattedQuery = `(${query})`;
      }
      
      // Use TimelineVol to get article distribution across tone ranges
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(formattedQuery)}&mode=TimelineVol&timespan=${timespan}&format=csv`;
      
      console.log('[Sentiment Analyzer] Fetching:', url);

      const response = await fetch(url);
      if (!response.ok) {
        console.error('[Sentiment Analyzer] HTTP error:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      console.log('[Sentiment Analyzer] Received', csvText.length, 'characters');
      console.log('[Sentiment Analyzer] First 200 chars:', csvText.substring(0, 200));
      return csvText;
    } catch (error) {
      console.error('[Sentiment Analyzer] Error fetching sentiment data:', error);
      return null;
    }
  }

  /**
   * Parse GDELT TimelineVol CSV data
   * TimelineVol format: Date,Series,Volume where Series are tone buckets
   * Example buckets: "Tone < -10", "Tone -10 to -5", "Tone -5 to 0", etc.
   */
  function parseToneData(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      return { dates: [], tones: [] };
    }

    const dates = [];
    const tones = [];
    
    // TimelineVol gives volume distribution, we need to reconstruct approximate tone values
    // by creating synthetic data points weighted by volume in each bucket
    
    const lines = csvText.trim().split('\n');
    const dateData = {}; // Group by date
    
    // Skip header, process data
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length >= 3) {
        const date = parts[0].trim();
        const series = parts[1].trim();
        const volume = parseInt(parts[2].trim());
        
        if (!date || isNaN(volume) || volume === 0) continue;
        
        // Extract tone range from series name
        let toneValue = 0;
        if (series.includes('< -10')) toneValue = -12;
        else if (series.includes('-10 to -5')) toneValue = -7.5;
        else if (series.includes('-5 to 0')) toneValue = -2.5;
        else if (series.includes('0 to 5')) toneValue = 2.5;
        else if (series.includes('5 to 10')) toneValue = 7.5;
        else if (series.includes('> 10')) toneValue = 12;
        else continue;
        
        // Create multiple data points based on volume (for statistical weight)
        for (let j = 0; j < Math.min(volume, 10); j++) { // Cap at 10 to avoid too much data
          dates.push(date);
          tones.push(toneValue);
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
    
    console.log('[Sentiment Analyzer] Parsed', tones.length, 'data points');

    if (tones.length === 0) {
      return {
        success: false,
        error: 'No sentiment data available for this query. This may mean there are very few or no articles matching your search criteria in the selected timespan.',
      };
    }

    // Calculate statistics
    const avgTone = tones.reduce((sum, val) => sum + val, 0) / tones.length;
    const minTone = Math.min(...tones);
    const maxTone = Math.max(...tones);
    const volatility = calculateVolatility(tones);
    const trend = calculateTrend(tones);
    
    // Calculate percentage of negative periods
    const negativeCount = tones.filter(t => t < 0).length;
    const negativePercent = Math.round((negativeCount / tones.length) * 100);

    // Generate classifications
    const classification = classifyTone(avgTone);
    const volatilityClass = classifyVolatility(volatility);

    // Analyze recent period (last 20% of data) vs overall
    const recentCount = Math.max(10, Math.floor(tones.length * 0.2));
    const recentTones = tones.slice(-recentCount);
    const recentAvg = recentTones.reduce((sum, val) => sum + val, 0) / recentTones.length;
    const recentMin = Math.min(...recentTones);
    const recentTrend = calculateTrend(recentTones);
    
    // Statistical comparison: is recent period significantly different?
    const historicalTones = tones.slice(0, -recentCount);
    const historicalAvg = historicalTones.reduce((sum, val) => sum + val, 0) / historicalTones.length;
    const recentVsHistorical = recentAvg - historicalAvg;
    
    // Detect episodic negative spikes (values significantly worse than average)
    const threshold = avgTone - volatility * 1.5;
    const episodicSpikes = tones.filter(t => t < threshold && t < -2).length;
    const hasEpisodicSpikes = episodicSpikes > tones.length * 0.1; // More than 10% are extreme
    
    // Determine baseline sentiment state
    const isConsistentlyNegative = negativePercent > 75;
    const isMostlyNegative = negativePercent > 60;
    
    // Analyze trend quality
    const trendIsSignificant = trend.rSquared > 0.15;
    const recentTrendIsSignificant = recentTrend.rSquared > 0.15;
    const isDeclining = trend.slope < -0.005;
    
    // Generate intelligent description based on full statistical picture
    let overallDescription = '';
    
    if (isConsistentlyNegative && hasEpisodicSpikes && isDeclining) {
      overallDescription = 'consistently negative, episodically very negative, and generally declining';
    } else if (isConsistentlyNegative && hasEpisodicSpikes) {
      overallDescription = 'consistently negative with episodic very negative spikes';
    } else if (isConsistentlyNegative && isDeclining) {
      overallDescription = 'consistently negative and declining';
    } else if (isMostlyNegative && hasEpisodicSpikes) {
      overallDescription = 'predominantly negative with episodic spikes';
    } else if (isConsistentlyNegative) {
      overallDescription = 'consistently negative';
    } else if (trendIsSignificant) {
      overallDescription = trend.direction;
    } else {
      overallDescription = `${trend.direction} (weak trend)`;
    }
    
    // Generate intelligent recent description
    let recentDescription = '';
    const isAtLows = Math.abs(recentMin - minTone) < volatility * 0.3;
    
    if (isAtLows && recentAvg < -2) {
      recentDescription = 'at or near period lows - highly negative';
    } else if (recentAvg < -2) {
      recentDescription = 'highly negative';
    } else if (recentAvg < -0.5) {
      if (recentTrendIsSignificant && recentTrend.slope > 0.01) {
        recentDescription = `recovering from negative levels (currently ${recentAvg.toFixed(2)})`;
      } else if (recentTrend.slope < -0.01) {
        recentDescription = `declining further into negative territory (${recentAvg.toFixed(2)})`;
      } else {
        recentDescription = 'persistently negative';
      }
    } else if (recentVsHistorical < -0.5) {
      recentDescription = 'deteriorating compared to historical average';
    } else if (recentVsHistorical > 0.5) {
      recentDescription = 'improving compared to historical average';
    } else {
      recentDescription = recentTrend.direction;
    }

    return {
      success: true,
      dataPoints: tones.length,
      timespan: timespan,
      statistics: {
        average: avgTone.toFixed(2),
        minimum: minTone.toFixed(2),
        maximum: maxTone.toFixed(2),
        volatility: volatility.toFixed(2),
        negativePercent: negativePercent,
        recentAverage: recentAvg.toFixed(2),
        recentMin: recentMin.toFixed(2),
        historicalAvg: historicalAvg.toFixed(2),
        recentVsHistorical: recentVsHistorical.toFixed(2),
        episodicSpikes: episodicSpikes,
      },
      classification: {
        overall: classification,
        volatility: volatilityClass,
      },
      trend: {
        overall: trend.direction,
        overallSlope: trend.slope.toFixed(4),
        overallR2: trend.rSquared.toFixed(3),
        recent: recentTrend.direction,
        recentSlope: recentTrend.slope.toFixed(4),
        recentR2: recentTrend.rSquared.toFixed(3),
        overallDescription: overallDescription,
        recentDescription: recentDescription,
        trendIsSignificant: trendIsSignificant,
        recentTrendIsSignificant: recentTrendIsSignificant,
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
    
    // Negative percentage statement
    const negativeStatement = statistics.negativePercent > 50 ? 
      `<br><small style="color: #c33; font-weight: 500;">Generally negative: ${statistics.negativePercent}% of periods below zero</small>` : '';
    
    // Episodic spikes statement
    const spikesStatement = statistics.episodicSpikes > 0 ?
      `<br><small style="color: #d44; font-weight: 500;">${statistics.episodicSpikes} episodic very negative spikes detected</small>` : '';
    
    // Overall trend description
    const overallTrendText = `Coverage is <em>${trend.overallDescription}</em>`;
    
    // Recent vs historical comparison
    const recentVsHist = parseFloat(statistics.recentVsHistorical);
    let comparisonText = '';
    if (Math.abs(recentVsHist) > 0.3) {
      const direction = recentVsHist > 0 ? 'above' : 'below';
      const color = recentVsHist > 0 ? '#3a3' : '#c33';
      comparisonText = `<br><small style="color: ${color};">Recent avg (${statistics.recentAverage}) is ${Math.abs(recentVsHist)} ${direction} historical avg (${statistics.historicalAvg})</small>`;
    }

    return `
      <div class="sentiment-analysis-results">
        <h4 style="margin: 0 0 0.5em 0; color: #0c1b50;">Sentiment Analysis</h4>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Classification:</strong> ${classification.overall}
          <br><small style="color: #666;">(Overall average: ${statistics.average}, Recent: ${statistics.recentAverage})</small>${negativeStatement}${spikesStatement}
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Overall Pattern:</strong> ${overallTrendText}
          <br><small style="color: #666;">(Slope: ${trend.overallSlope}, R²: ${trend.overallR2})</small>
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Recent Period:</strong> <em>${trend.recentDescription}</em>${comparisonText}
          <br><small style="color: #666;">(Recent R²: ${trend.recentR2}, Min: ${statistics.recentMin})</small>
        </div>
        
        <div style="margin-bottom: 0.8em;">
          <strong>Volatility:</strong> Coverage tone is <em>${classification.volatility}</em>
          <br><small style="color: #666;">(Std. deviation: ${statistics.volatility})</small>
        </div>
        
        <div style="padding-top: 0.5em; border-top: 1px solid #e0e0e0; font-size: 0.9em; color: #666;">
          Analysis based on ${dataPoints} data points
          <br>Full range: ${statistics.minimum} to ${statistics.maximum}
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
