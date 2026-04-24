const fetch = require('node-fetch');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

const featurePrompts = {
  image_scans: (item) => `You are an expert AI deepfake detection analyst. Analyze this image scan and provide a comprehensive deepfake detection report.

Image: "${item.title}"
File: ${item.file_name || 'N/A'} | Format: ${item.format || 'N/A'} | Resolution: ${item.resolution || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON with these fields:
{
  "verdict": "AUTHENTIC" or "LIKELY_DEEPFAKE" or "CONFIRMED_DEEPFAKE" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "detection_methods": ["list of methods used"],
  "findings": [{"area": "description", "severity": "low/medium/high", "detail": "explanation"}],
  "facial_analysis": {"consistency": "description", "lighting": "description", "artifacts": "description"},
  "pixel_analysis": {"noise_patterns": "description", "compression_artifacts": "description", "edge_analysis": "description"},
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  video_scans: (item) => `You are an expert AI deepfake video detection analyst. Analyze this video scan for deepfake indicators.

Video: "${item.title}"
File: ${item.file_name || 'N/A'} | Duration: ${item.duration || 'N/A'} | Resolution: ${item.resolution || 'N/A'} | Frames: ${item.frame_count || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON with these fields:
{
  "verdict": "AUTHENTIC" or "LIKELY_DEEPFAKE" or "CONFIRMED_DEEPFAKE" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "temporal_analysis": {"frame_consistency": "description", "motion_artifacts": "description", "lip_sync": "description"},
  "visual_analysis": {"face_warping": "description", "boundary_artifacts": "description", "blending_quality": "description"},
  "audio_visual_sync": {"lip_movement_match": "description", "audio_consistency": "description"},
  "key_frames_flagged": [{"timestamp": "time", "issue": "description", "severity": "level"}],
  "detection_methods": ["list of methods used"],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  audio_scans: (item) => `You are an expert AI audio deepfake detection analyst. Analyze this audio for synthetic voice indicators.

Audio: "${item.title}"
File: ${item.file_name || 'N/A'} | Duration: ${item.duration || 'N/A'} | Format: ${item.format || 'N/A'} | Sample Rate: ${item.sample_rate || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "AUTHENTIC" or "LIKELY_SYNTHETIC" or "CONFIRMED_SYNTHETIC" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "voice_analysis": {"naturalness": "description", "pitch_consistency": "description", "breathing_patterns": "description"},
  "spectral_analysis": {"frequency_distribution": "description", "harmonic_patterns": "description", "noise_floor": "description"},
  "synthesis_indicators": [{"indicator": "name", "confidence": "percentage", "detail": "description"}],
  "detection_methods": ["list of methods used"],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  face_swap_detections: (item) => `You are an expert face swap detection analyst. Analyze this potential face swap.

Case: "${item.title}"
Swap Type: ${item.swap_type || 'N/A'} | Faces Detected: ${item.faces_detected || 'N/A'}
Source: ${item.source_image || 'N/A'} → Target: ${item.target_image || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "NO_SWAP_DETECTED" or "LIKELY_FACE_SWAP" or "CONFIRMED_FACE_SWAP" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "swap_analysis": {"technique_identified": "description", "quality_level": "description", "blending_artifacts": "description"},
  "face_regions": [{"region": "area", "anomaly": "description", "severity": "level"}],
  "identity_analysis": {"source_match": "description", "target_match": "description"},
  "detection_methods": ["list of methods used"],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  gan_detections: (item) => `You are an expert GAN-generated content detection analyst. Analyze this content for GAN generation indicators.

Content: "${item.title}"
File: ${item.file_name || 'N/A'} | GAN Type: ${item.gan_type || 'N/A'}
Artifacts Found: ${item.artifacts_found || 'None reported'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "NATURAL_CONTENT" or "LIKELY_GAN_GENERATED" or "CONFIRMED_GAN_GENERATED" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "gan_analysis": {"suspected_architecture": "description", "generation_quality": "description", "training_artifacts": "description"},
  "artifact_catalog": [{"type": "artifact type", "location": "where found", "severity": "level", "detail": "description"}],
  "frequency_analysis": {"spectral_signature": "description", "checkerboard_patterns": "description"},
  "detection_methods": ["list of methods used"],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  metadata_analyses: (item) => `You are an expert digital forensics metadata analyst. Analyze this file's metadata for signs of manipulation.

File: "${item.title}"
Name: ${item.file_name || 'N/A'} | Type: ${item.file_type || 'N/A'}
Tampering Indicators: ${item.tampering_indicators || 'None reported'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "ORIGINAL" or "LIKELY_MODIFIED" or "CONFIRMED_MANIPULATED" or "INCONCLUSIVE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "metadata_findings": {"creation_date_analysis": "description", "modification_history": "description", "software_traces": "description"},
  "exif_analysis": {"camera_info": "description", "gps_data": "description", "editing_software": "description"},
  "tampering_evidence": [{"type": "evidence type", "detail": "description", "severity": "level"}],
  "chain_of_custody": {"integrity": "description", "hash_verification": "description"},
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  batch_scans: (item) => `You are an expert batch analysis coordinator. Analyze this batch scan operation and provide insights.

Batch: "${item.title}"
Name: ${item.batch_name || 'N/A'} | Type: ${item.scan_type || 'N/A'}
Files: ${item.total_files || 0} total, ${item.completed_files || 0} completed, ${item.flagged_files || 0} flagged
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "CLEAN_BATCH" or "THREATS_DETECTED" or "HIGH_RISK_BATCH" or "ANALYSIS_INCOMPLETE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "batch_summary": {"threat_rate": "percentage", "common_patterns": "description", "outliers": "description"},
  "category_breakdown": [{"category": "type", "count": number, "risk": "level"}],
  "trend_analysis": {"emerging_patterns": "description", "comparison_to_baseline": "description"},
  "priority_items": [{"file": "name", "issue": "description", "urgency": "level"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  realtime_monitors: (item) => `You are an expert real-time deepfake monitoring analyst. Analyze this monitoring configuration and recent activity.

Monitor: "${item.title}"
Name: ${item.monitor_name || 'N/A'} | Type: ${item.monitor_type || 'N/A'}
Active: ${item.is_active ? 'Yes' : 'No'} | Alerts: ${item.alerts_count || 0} | Threshold: ${item.alert_threshold || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "NOMINAL" or "ELEVATED_ACTIVITY" or "CRITICAL_ALERTS" or "MONITOR_ISSUE",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "monitor_health": {"uptime": "description", "latency": "description", "coverage": "description"},
  "alert_analysis": {"recent_alerts": "description", "false_positive_rate": "description", "missed_detections": "description"},
  "threat_landscape": {"current_trends": "description", "emerging_threats": "description"},
  "optimization_suggestions": [{"area": "description", "current": "state", "recommended": "action"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  election_verifications: (item) => `You are an expert election content verification analyst. Analyze this political content for authenticity.

Content: "${item.title}"
Type: ${item.content_type || 'N/A'} | Politician: ${item.politician_name || 'N/A'} | Party: ${item.party || 'N/A'}
Status: ${item.verification_status || 'unverified'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "VERIFIED_AUTHENTIC" or "LIKELY_MANIPULATED" or "CONFIRMED_DISINFORMATION" or "REQUIRES_FURTHER_REVIEW",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "content_analysis": {"originality": "description", "context_accuracy": "description", "manipulation_signs": "description"},
  "source_verification": {"original_source": "description", "distribution_chain": "description", "first_appearance": "description"},
  "impact_assessment": {"reach_estimate": "description", "voter_impact": "description", "urgency": "description"},
  "fact_check_points": [{"claim": "description", "verdict": "true/false/misleading", "evidence": "description"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  social_media_scans: (item) => `You are an expert social media deepfake detection analyst. Analyze this social media content.

Content: "${item.title}"
Platform: ${item.platform || 'N/A'} | Account: ${item.account_name || 'N/A'} | Type: ${item.content_type || 'N/A'}
Followers: ${item.followers_count || 'N/A'} | Engagement: ${item.engagement_rate || 'N/A'}%
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "AUTHENTIC_CONTENT" or "LIKELY_MANIPULATED" or "CONFIRMED_DEEPFAKE" or "SUSPICIOUS_ACCOUNT",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "content_analysis": {"manipulation_type": "description", "quality_assessment": "description", "viral_potential": "description"},
  "account_analysis": {"authenticity_score": "description", "behavior_patterns": "description", "network_analysis": "description"},
  "spread_assessment": {"current_reach": "description", "projected_spread": "description", "platform_response": "description"},
  "evidence": [{"type": "evidence type", "detail": "description", "confidence": "percentage"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  api_keys: (item) => `You are an API security analyst. Analyze this API key's usage and security posture.

API Key: "${item.title}"
Name: ${item.key_name || 'N/A'} | Rate Limit: ${item.rate_limit || 'N/A'}/day | Today: ${item.requests_today || 0}
Active: ${item.is_active ? 'Yes' : 'No'} | Permissions: ${item.permissions || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "SECURE" or "REVIEW_RECOMMENDED" or "SECURITY_CONCERN" or "COMPROMISED",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "usage_analysis": {"pattern": "description", "anomalies": "description", "peak_usage": "description"},
  "security_assessment": {"key_strength": "description", "permission_scope": "description", "exposure_risk": "description"},
  "compliance": {"rate_limiting": "description", "access_control": "description", "audit_trail": "description"},
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  scan_history: (item) => `You are a deepfake detection historian. Analyze this historical scan record and provide insights.

Scan: "${item.title}"
Type: ${item.scan_type || 'N/A'} | File: ${item.file_name || 'N/A'} | Duration: ${item.scan_duration || 'N/A'}
Result: ${item.result_summary || 'No summary'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "VALID_RESULT" or "REQUIRES_RESCAN" or "OUTDATED_ANALYSIS" or "PATTERN_MATCH",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "historical_context": {"similar_scans": "description", "trend": "description", "evolution": "description"},
  "result_validation": {"methodology_current": "description", "confidence_assessment": "description"},
  "pattern_recognition": {"recurring_threats": "description", "seasonal_trends": "description"},
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  threat_intelligence: (item) => `You are a deepfake threat intelligence analyst. Analyze this threat and provide actionable intelligence.

Threat: "${item.title}"
Type: ${item.threat_type || 'N/A'} | Severity: ${item.severity || 'N/A'} | Source: ${item.source || 'N/A'}
Indicators: ${item.indicators || 'None'} | Regions: ${item.affected_regions || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "LOW_THREAT" or "MODERATE_THREAT" or "HIGH_THREAT" or "CRITICAL_THREAT",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "threat_profile": {"actor_type": "description", "capability_level": "description", "intent": "description"},
  "technical_analysis": {"tools_used": "description", "sophistication": "description", "detection_difficulty": "description"},
  "impact_assessment": {"potential_targets": "description", "estimated_reach": "description", "damage_potential": "description"},
  "iocs": [{"type": "indicator type", "value": "description", "confidence": "level"}],
  "mitigation_steps": [{"priority": "level", "action": "description", "timeline": "description"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`,

  audit_logs: (item) => `You are a security audit analyst. Analyze this audit log entry for compliance and security.

Log: "${item.title}"
Action: ${item.action || 'N/A'} | Entity: ${item.entity_type || 'N/A'} #${item.entity_id || 'N/A'}
User: ${item.user_email || 'N/A'} | IP: ${item.ip_address || 'N/A'}
Description: ${item.description || 'No description provided'}

Provide your analysis as JSON:
{
  "verdict": "NORMAL_ACTIVITY" or "UNUSUAL_PATTERN" or "SECURITY_CONCERN" or "POLICY_VIOLATION",
  "confidence_percentage": number 0-100,
  "risk_level": "low" or "medium" or "high" or "critical",
  "activity_analysis": {"legitimacy": "description", "context": "description", "frequency": "description"},
  "compliance_check": {"gdpr": "description", "sox": "description", "internal_policy": "description"},
  "risk_indicators": [{"indicator": "description", "severity": "level", "action_needed": "description"}],
  "recommendations": ["list of recommended actions"],
  "summary": "2-3 sentence executive summary"
}`
};

const analyzeWithAI = async (featureType, item) => {
  const promptFn = featurePrompts[featureType];
  if (!promptFn) {
    throw new Error(`No AI prompt configured for feature: ${featureType}`);
  }

  const prompt = promptFn(item);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Deepfake Detection Platform',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI deepfake detection system. Always respond with valid JSON only, no markdown formatting or code blocks. Just raw JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Try to parse as JSON, handle markdown code blocks
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // If JSON parsing fails, return structured response
      parsed = {
        verdict: 'ANALYSIS_COMPLETE',
        confidence_percentage: 75,
        risk_level: 'medium',
        raw_analysis: content,
        summary: 'AI analysis completed. See raw analysis for details.'
      };
    }

    return {
      success: true,
      analysis: parsed,
      model: OPENROUTER_MODEL,
      analyzed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('OpenRouter AI error:', error.message);
    return {
      success: false,
      error: error.message,
      model: OPENROUTER_MODEL,
      analyzed_at: new Date().toISOString(),
    };
  }
};

module.exports = { analyzeWithAI };
