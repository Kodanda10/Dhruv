import * as d3 from 'd3';

export function formatDateForChart(dateString: string): Date {
  const date = new Date(dateString);
  return date;
}

export function getColorScale(data: number[]): d3.ScaleSequential<string> {
  if (data.length === 0) {
    return d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);
  }
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  
  return d3.scaleSequential(d3.interpolateBlues).domain([min, max]);
}

export function calculateChartDimensions(
  containerWidth: number,
  containerHeight: number
): {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
} {
  const margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20
  };

  const width = Math.max(0, containerWidth - margin.left - margin.right);
  const height = Math.max(0, containerHeight - margin.top - margin.bottom);

  return {
    width,
    height,
    margin
  };
}

export function createTimeScale(
  data: any[],
  width: number,
  dateField: string = 'date'
): d3.ScaleTime<number, number> {
  if (data.length === 0) {
    return d3.scaleTime().domain([new Date(), new Date()]).range([0, width]);
  }

  const dates = data.map(d => formatDateForChart(d[dateField]));
  const extent = d3.extent(dates) as [Date, Date];
  
  return d3.scaleTime().domain(extent).range([0, width]);
}

export function createLinearScale(
  data: number[],
  height: number
): d3.ScaleLinear<number, number> {
  if (data.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range([height, 0]);
  }

  const extent = d3.extent(data) as [number, number];
  
  return d3.scaleLinear().domain(extent).range([height, 0]);
}

export function createOrdinalScale(
  data: string[],
  width: number
): d3.ScaleBand<string> {
  return d3.scaleBand()
    .domain(data)
    .range([0, width])
    .padding(0.1);
}

export function createPieScale(data: any[]): d3.Pie<any, any> {
  return d3.pie()
    .value((d: any) => d.value)
    .sort(null);
}

export function getHindiDayLabels(): Record<string, string> {
  return {
    '0': 'रविवार',
    '1': 'सोमवार', 
    '2': 'मंगलवार',
    '3': 'बुधवार',
    '4': 'गुरुवार',
    '5': 'शुक्रवार',
    '6': 'शनिवार'
  };
}

export function classifyNarrative(tweet: any): string {
  const content = (tweet.content || '').toLowerCase();
  const eventType = (tweet.parsed?.event_type || '').toLowerCase();
  
  if (eventType.includes('योजना') || content.includes('योजना')) {
    return 'Schemes';
  }
  if (eventType.includes('श्रद्धांजलि') || content.includes('शोक')) {
    return 'Tribute';
  }
  if (eventType.includes('उद्घाटन') || content.includes('विकास')) {
    return 'Development';
  }
  if (content.includes('चुनाव') || content.includes('राजनीति')) {
    return 'Politics';
  }
  
  return 'Other';
}

export function generateInsights(
  currentData: any,
  previousData?: any
): Array<{
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: string;
}> {
  const insights = [];

  // Most active location
  if (currentData.locations && currentData.locations.length > 0) {
    const topLocation = currentData.locations[0];
    insights.push({
      title: 'सबसे सक्रिय स्थान',
      value: `${topLocation.name} (${topLocation.count} पोस्ट)`,
      trend: 'neutral',
      trendValue: '',
      icon: '📍'
    });
  }

  // Average confidence
  if (currentData.avgConfidence !== undefined) {
    insights.push({
      title: 'औसत विश्वास स्कोर',
      value: `${Math.round(currentData.avgConfidence * 100)}%`,
      trend: 'neutral',
      trendValue: '',
      icon: '📊'
    });
  }

  // Most common event type
  if (currentData.eventTypes && currentData.eventTypes.length > 0) {
    const topEventType = currentData.eventTypes[0];
    insights.push({
      title: 'सबसे आम घटना प्रकार',
      value: `${topEventType.label} (${topEventType.percentage}%)`,
      trend: 'neutral',
      trendValue: '',
      icon: '🎯'
    });
  }

  return insights.slice(0, 4); // Return top 4 insights
}
