const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool, initDB } = require('./db');

const seed = async () => {
  try {
    await initDB();
    console.log('Tables created. Seeding data...');

    // Clear existing data
    const tables = [
      'audit_logs', 'threat_intelligence', 'scan_history', 'api_keys',
      'social_media_scans', 'election_verifications', 'realtime_monitors',
      'batch_scans', 'metadata_analyses', 'gan_detections', 'face_swap_detections',
      'audio_scans', 'video_scans', 'image_scans', 'users'
    ];
    for (const t of tables) {
      await pool.query(`DELETE FROM ${t}`);
      await pool.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
    }

    // Seed Users (15)
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = [
      ['admin@deepfake.ai', passwordHash, 'Sarah Chen', 'admin', 'DeepfakeGuard Inc'],
      ['analyst1@deepfake.ai', passwordHash, 'Marcus Johnson', 'analyst', 'DeepfakeGuard Inc'],
      ['analyst2@deepfake.ai', passwordHash, 'Priya Patel', 'analyst', 'CyberSec Corp'],
      ['reviewer@deepfake.ai', passwordHash, 'James Wilson', 'reviewer', 'TrustVerify LLC'],
      ['manager@deepfake.ai', passwordHash, 'Elena Rodriguez', 'manager', 'DeepfakeGuard Inc'],
      ['gov.analyst@deepfake.ai', passwordHash, 'David Kim', 'analyst', 'US Dept of Homeland Security'],
      ['eu.analyst@deepfake.ai', passwordHash, 'Sophie Laurent', 'analyst', 'EU Digital Services'],
      ['researcher@deepfake.ai', passwordHash, 'Akira Tanaka', 'researcher', 'MIT Media Lab'],
      ['enterprise1@deepfake.ai', passwordHash, 'Robert Brown', 'enterprise', 'Meta Platforms'],
      ['enterprise2@deepfake.ai', passwordHash, 'Lisa Wang', 'enterprise', 'Google DeepMind'],
      ['auditor@deepfake.ai', passwordHash, 'Michael O\'Brien', 'auditor', 'PwC Cybersecurity'],
      ['intern@deepfake.ai', passwordHash, 'Zara Ahmed', 'intern', 'DeepfakeGuard Inc'],
      ['contractor@deepfake.ai', passwordHash, 'Carlos Mendez', 'contractor', 'SecureAI Consulting'],
      ['partner@deepfake.ai', passwordHash, 'Nina Volkov', 'partner', 'Interpol Cyber Division'],
      ['api.user@deepfake.ai', passwordHash, 'Thomas Fischer', 'api_user', 'NewsGuard Technologies'],
    ];
    for (const u of users) {
      await pool.query('INSERT INTO users (email, password_hash, full_name, role, organization) VALUES ($1,$2,$3,$4,$5)', u);
    }
    console.log('Seeded 15 users');

    // Seed Image Scans (15)
    const imageScans = [
      ['Presidential Address Deepfake Check', 'Analysis of viral presidential address image circulating on social media', 'president_address_2024.jpg', '4.2 MB', 'JPEG', '3840x2160', 'analyzed', 'critical', 97.5],
      ['Celebrity Endorsement Verification', 'Suspected deepfake celebrity product endorsement image', 'celeb_endorsement.png', '6.1 MB', 'PNG', '2560x1440', 'analyzed', 'high', 89.2],
      ['Corporate Executive Headshot', 'Verification of CEO headshot used in press release', 'ceo_headshot.jpg', '2.8 MB', 'JPEG', '1920x1080', 'analyzed', 'low', 12.3],
      ['Social Media Profile Image', 'Suspected AI-generated profile picture on dating app', 'profile_suspicious.jpg', '1.5 MB', 'JPEG', '1024x1024', 'analyzed', 'high', 94.1],
      ['News Broadcast Screenshot', 'Manipulated news anchor image from fake broadcast', 'news_anchor.png', '3.7 MB', 'PNG', '1920x1080', 'analyzed', 'critical', 98.7],
      ['Political Campaign Flyer', 'Campaign material with potentially altered candidate image', 'campaign_flyer.jpg', '5.0 MB', 'JPEG', '4096x2304', 'pending', 'medium', 45.6],
      ['Passport Photo Analysis', 'Suspected altered passport photo for identity fraud', 'passport_scan.jpg', '0.8 MB', 'JPEG', '600x600', 'analyzed', 'high', 78.9],
      ['Satellite Imagery Check', 'Verification of satellite images showing military activity', 'satellite_img.tiff', '15.2 MB', 'TIFF', '8192x8192', 'analyzing', 'medium', null],
      ['Art Authentication Scan', 'Digital artwork suspected of being AI-generated', 'digital_art.png', '8.4 MB', 'PNG', '4096x4096', 'analyzed', 'high', 91.0],
      ['Insurance Claim Photo', 'Damage photo submitted with insurance claim', 'damage_photo.jpg', '3.1 MB', 'JPEG', '2048x1536', 'analyzed', 'medium', 56.7],
      ['Medical Image Verification', 'X-ray image verification for telemedicine', 'xray_chest.dcm', '12.0 MB', 'DICOM', '3000x3000', 'analyzed', 'low', 8.2],
      ['ID Card Verification', 'Government ID card photo verification', 'id_card.jpg', '1.2 MB', 'JPEG', '800x600', 'analyzed', 'medium', 62.4],
      ['Evidence Photo Analysis', 'Court evidence photo authenticity check', 'evidence_001.jpg', '4.5 MB', 'JPEG', '2560x1920', 'analyzed', 'high', 85.3],
      ['Social Media Meme Check', 'Viral meme with manipulated political figure', 'political_meme.jpg', '0.9 MB', 'JPEG', '1200x630', 'analyzed', 'medium', 71.8],
      ['Product Review Image', 'Suspected AI-generated product review images', 'product_review.png', '2.3 MB', 'PNG', '1600x1200', 'analyzed', 'low', 34.5],
    ];
    for (const s of imageScans) {
      await pool.query(
        'INSERT INTO image_scans (title, description, file_name, file_size, format, resolution, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, 1)',
        s
      );
    }
    console.log('Seeded 15 image scans');

    // Seed Video Scans (15)
    const videoScans = [
      ['Political Speech Deepfake', 'Viral video of political figure making controversial statement', 'political_speech.mp4', '245 MB', 'MP4', '02:34', '1920x1080', 3660, 'analyzed', 'critical', 96.8],
      ['CEO Earnings Call Video', 'Suspicious video of CEO discussing financial results', 'earnings_call.mp4', '180 MB', 'MP4', '05:12', '1080x720', 9360, 'analyzed', 'high', 88.4],
      ['News Anchor Replacement', 'News broadcast with suspected face-swapped anchor', 'news_broadcast.mp4', '520 MB', 'MP4', '10:00', '1920x1080', 18000, 'analyzed', 'critical', 99.1],
      ['Celebrity Interview Fake', 'Fabricated celebrity interview video', 'celeb_interview.mp4', '312 MB', 'MP4', '06:45', '1920x1080', 12150, 'analyzed', 'high', 92.7],
      ['Security Camera Footage', 'Altered security camera footage from robbery', 'security_cam.avi', '890 MB', 'AVI', '15:30', '1280x720', 27900, 'analyzed', 'medium', 67.3],
      ['Campaign Ad Analysis', 'Political campaign advertisement verification', 'campaign_ad.mp4', '95 MB', 'MP4', '00:30', '3840x2160', 900, 'analyzed', 'high', 81.5],
      ['Webinar Recording Check', 'Corporate webinar with suspected AI presenter', 'webinar.mp4', '1.2 GB', 'MP4', '45:00', '1920x1080', 81000, 'pending', 'medium', null],
      ['TikTok Viral Video', 'Viral TikTok showing impossible scenario', 'tiktok_viral.mp4', '45 MB', 'MP4', '00:15', '1080x1920', 450, 'analyzed', 'low', 23.4],
      ['Court Evidence Video', 'Video evidence submitted for legal proceeding', 'evidence_video.mp4', '675 MB', 'MP4', '12:00', '1920x1080', 21600, 'analyzed', 'high', 87.9],
      ['Training Video Analysis', 'Corporate training video authenticity check', 'training.mp4', '2.1 GB', 'MP4', '60:00', '1920x1080', 108000, 'analyzed', 'low', 5.6],
      ['Live Stream Recording', 'Recorded live stream with potential manipulation', 'livestream.mp4', '3.5 GB', 'MP4', '120:00', '1920x1080', 216000, 'analyzing', 'medium', null],
      ['Documentary Clip Verify', 'Documentary footage authenticity verification', 'documentary_clip.mov', '450 MB', 'MOV', '08:30', '4096x2160', 15300, 'analyzed', 'low', 11.2],
      ['Social Media Reel', 'Instagram reel with suspected deepfake content', 'insta_reel.mp4', '28 MB', 'MP4', '00:30', '1080x1920', 900, 'analyzed', 'high', 93.5],
      ['Video Testimony Check', 'Remote testimony video verification', 'testimony.mp4', '380 MB', 'MP4', '07:15', '1280x720', 13050, 'analyzed', 'medium', 54.2],
      ['Propaganda Video Scan', 'Foreign propaganda video deepfake analysis', 'propaganda.mp4', '890 MB', 'MP4', '18:45', '1920x1080', 33750, 'analyzed', 'critical', 97.3],
    ];
    for (const s of videoScans) {
      await pool.query(
        'INSERT INTO video_scans (title, description, file_name, file_size, format, duration, resolution, frame_count, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, 1)',
        s
      );
    }
    console.log('Seeded 15 video scans');

    // Seed Audio Scans (15)
    const audioScans = [
      ['CEO Voice Clone Detection', 'Suspected AI-cloned CEO voice in earnings call', 'ceo_voice.wav', '12.5 MB', 'WAV', '03:45', '44100 Hz', 'analyzed', 'critical', 95.2],
      ['Ransom Call Analysis', 'Kidnapping ransom call voice authentication', 'ransom_call.mp3', '4.8 MB', 'MP3', '02:10', '48000 Hz', 'analyzed', 'high', 88.7],
      ['Political Robocall', 'Automated political call with AI-generated voice', 'robocall.wav', '8.2 MB', 'WAV', '01:30', '44100 Hz', 'analyzed', 'critical', 97.8],
      ['Podcast Episode Verify', 'Podcast with suspected AI-generated guest voice', 'podcast_ep.mp3', '45 MB', 'MP3', '32:00', '44100 Hz', 'analyzed', 'medium', 62.3],
      ['Phone Fraud Recording', 'Bank fraud attempt using cloned voice', 'fraud_call.wav', '6.1 MB', 'WAV', '01:55', '16000 Hz', 'analyzed', 'high', 91.4],
      ['Voice Message Authentication', 'WhatsApp voice message verification', 'voice_msg.ogg', '0.8 MB', 'OGG', '00:42', '16000 Hz', 'analyzed', 'medium', 55.9],
      ['Conference Call Recording', 'Multi-party conference call speaker verification', 'conference.wav', '78 MB', 'WAV', '45:00', '44100 Hz', 'pending', 'low', null],
      ['911 Emergency Call', 'Emergency call voice authenticity check', '911_call.wav', '3.2 MB', 'WAV', '01:05', '8000 Hz', 'analyzed', 'high', 82.1],
      ['Music Deepfake Check', 'AI-generated music mimicking famous artist', 'music_fake.mp3', '8.5 MB', 'MP3', '03:30', '44100 Hz', 'analyzed', 'medium', 73.6],
      ['Corporate Voicemail', 'Executive voicemail used for social engineering', 'voicemail.wav', '1.5 MB', 'WAV', '00:28', '16000 Hz', 'analyzed', 'high', 86.3],
      ['Audio Book Sample', 'Narrator voice verification for audio book', 'audiobook.mp3', '25 MB', 'MP3', '15:00', '44100 Hz', 'analyzed', 'low', 14.7],
      ['Witness Statement Audio', 'Legal witness audio statement verification', 'witness.wav', '15 MB', 'WAV', '04:30', '44100 Hz', 'analyzed', 'medium', 58.4],
      ['Radio Broadcast Clip', 'Radio broadcast with suspected fake caller', 'radio_clip.mp3', '5.2 MB', 'MP3', '02:15', '44100 Hz', 'analyzed', 'low', 28.9],
      ['Voice Assistant Attack', 'Adversarial audio targeting voice assistant', 'adversarial.wav', '0.3 MB', 'WAV', '00:05', '44100 Hz', 'analyzed', 'critical', 94.5],
      ['Interview Recording', 'Job interview recording voice check', 'interview.wav', '32 MB', 'WAV', '18:00', '44100 Hz', 'analyzed', 'low', 9.8],
    ];
    for (const s of audioScans) {
      await pool.query(
        'INSERT INTO audio_scans (title, description, file_name, file_size, format, duration, sample_rate, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 1)',
        s
      );
    }
    console.log('Seeded 15 audio scans');

    // Seed Face Swap Detections (15)
    const faceSwaps = [
      ['Executive Identity Swap', 'CEO face swapped onto body double in company video', 'ceo_original.jpg', 'body_double.jpg', 'Face2Face', 2, 'analyzed', 'critical', 96.3],
      ['Political Debate Manipulation', 'Candidate face swap in debate footage', 'candidate_a.jpg', 'candidate_b.jpg', 'DeepFaceLab', 4, 'analyzed', 'critical', 98.1],
      ['Celebrity Pornography', 'Non-consensual celebrity face swap content', 'celeb_source.jpg', 'target_content.jpg', 'FaceSwap', 2, 'analyzed', 'critical', 99.5],
      ['Social Media Catfishing', 'Dating profile using face-swapped images', 'stolen_face.jpg', 'catfish_profile.jpg', 'SimSwap', 1, 'analyzed', 'high', 87.6],
      ['Identity Document Fraud', 'Face swap on passport application photo', 'real_face.jpg', 'passport_app.jpg', 'FaceShifter', 1, 'analyzed', 'high', 91.2],
      ['News Anchor Impersonation', 'Fake news broadcast with swapped anchor face', 'real_anchor.jpg', 'fake_broadcast.jpg', 'FSGAN', 1, 'analyzed', 'high', 85.4],
      ['Corporate Espionage', 'Video call with face-swapped attendee for espionage', 'unknown_source.jpg', 'video_call.jpg', 'DeepFaceLab', 3, 'analyzed', 'critical', 93.8],
      ['Insurance Fraud Attempt', 'Face swap in surveillance footage for alibi', 'suspect.jpg', 'alibi_footage.jpg', 'Face2Face', 2, 'analyzed', 'high', 79.4],
      ['Witness Tampering', 'Court witness face swapped in evidence video', 'witness_real.jpg', 'evidence_vid.jpg', 'FaceSwap', 1, 'analyzed', 'critical', 95.7],
      ['Child Safety Alert', 'AI-generated face on child exploitation content', 'generated_face.jpg', 'flagged_content.jpg', 'StyleGAN', 1, 'analyzed', 'critical', 99.8],
      ['Event Attendance Fraud', 'Face swap to fake attendance at corporate event', 'employee_face.jpg', 'event_photo.jpg', 'SimSwap', 5, 'analyzed', 'medium', 68.3],
      ['Influencer Verification', 'Influencer using AI face in sponsored content', 'real_influencer.jpg', 'sponsored_post.jpg', 'FSGAN', 1, 'analyzed', 'medium', 72.1],
      ['Military Personnel Check', 'Verification of military personnel identification', 'personnel_file.jpg', 'checkpoint.jpg', 'FaceShifter', 1, 'pending', 'medium', null],
      ['Banking KYC Check', 'Video KYC verification with potential face swap', 'kyc_original.jpg', 'kyc_video.jpg', 'DeepFaceLab', 1, 'analyzed', 'high', 88.9],
      ['Academic Proctoring', 'Online exam proctoring face swap detection', 'student_id.jpg', 'exam_webcam.jpg', 'Face2Face', 1, 'analyzed', 'medium', 61.5],
    ];
    for (const s of faceSwaps) {
      await pool.query(
        'INSERT INTO face_swap_detections (title, description, source_image, target_image, swap_type, faces_detected, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, 1)',
        s
      );
    }
    console.log('Seeded 15 face swap detections');

    // Seed GAN Detections (15)
    const ganDetections = [
      ['StyleGAN3 Face Generation', 'Highly realistic AI-generated face used in fake profile', 'gan_face_001.png', 'StyleGAN3', 'Subtle frequency artifacts in hair region', 'analyzed', 'high', 92.4],
      ['DALL-E Generated Scene', 'AI-generated scene used as fake evidence', 'dalle_scene.png', 'DALL-E 3', 'Text rendering anomalies, impossible geometry', 'analyzed', 'medium', 78.5],
      ['Midjourney Art Fraud', 'AI art sold as human-created in gallery', 'midjourney_art.jpg', 'Midjourney v6', 'Characteristic Midjourney color patterns', 'analyzed', 'high', 85.7],
      ['Stable Diffusion Propaganda', 'Political propaganda images generated by SD', 'sd_propaganda.png', 'Stable Diffusion XL', 'Hand anomalies, text artifacts', 'analyzed', 'critical', 94.1],
      ['ProGAN Face Detection', 'AI-generated faces in social media bot network', 'progan_face.jpg', 'ProGAN', 'Spectral analysis shows GAN fingerprint', 'analyzed', 'high', 89.3],
      ['BigGAN Scene Fabrication', 'Fabricated crime scene images', 'biggan_scene.png', 'BigGAN', 'Unrealistic lighting, object boundary issues', 'analyzed', 'critical', 96.7],
      ['CycleGAN Style Transfer', 'Modified satellite imagery using style transfer', 'cyclegan_sat.tiff', 'CycleGAN', 'Cross-domain artifacts in translated regions', 'analyzed', 'high', 83.2],
      ['Imagen Generated Content', 'Product images that never existed', 'imagen_product.png', 'Imagen', 'Photorealistic but physically impossible details', 'analyzed', 'medium', 71.8],
      ['NVIDIA GauGAN Landscape', 'Fake real estate listing with generated landscape', 'gaugan_landscape.jpg', 'GauGAN', 'Semantic segmentation boundary artifacts', 'analyzed', 'medium', 65.4],
      ['Firefly Commercial Image', 'AI-generated commercial photography', 'firefly_commercial.jpg', 'Adobe Firefly', 'Metadata indicates AI generation', 'analyzed', 'low', 45.2],
      ['StarGAN Attribute Edit', 'Face attributes modified to change identity', 'stargan_edit.png', 'StarGAN v2', 'Attribute-specific artifacts around modified regions', 'analyzed', 'high', 87.6],
      ['Pix2Pix Modification', 'Building plans modified with AI translation', 'pix2pix_blueprint.png', 'Pix2Pix', 'Edge artifacts in translated regions', 'analyzed', 'medium', 59.8],
      ['VQGAN Hybrid Content', 'Text-to-image generated medical images', 'vqgan_medical.png', 'VQGAN-CLIP', 'Anatomical inconsistencies, texture anomalies', 'analyzed', 'critical', 97.2],
      ['Flux Generated Portrait', 'Ultra-realistic AI portrait for identity fraud', 'flux_portrait.png', 'Flux', 'Minimal artifacts, high sophistication', 'analyzing', 'high', null],
      ['Kandinsky Scene Gen', 'AI-generated news scene image', 'kandinsky_news.jpg', 'Kandinsky', 'Perspective and shadow inconsistencies', 'analyzed', 'medium', 74.3],
    ];
    for (const s of ganDetections) {
      await pool.query(
        'INSERT INTO gan_detections (title, description, file_name, gan_type, artifacts_found, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, 1)',
        s
      );
    }
    console.log('Seeded 15 GAN detections');

    // Seed Metadata Analyses (15)
    const metadataAnalyses = [
      ['Whistleblower Document', 'Leaked corporate document metadata analysis', 'leaked_doc.pdf', 'PDF', 'Creation date mismatch, author field modified', 'analyzed', 'high', 82.3],
      ['Crime Scene Photo EXIF', 'EXIF data analysis of crime scene photographs', 'crime_scene.jpg', 'JPEG', 'GPS coordinates removed, editing software traces', 'analyzed', 'critical', 91.5],
      ['Contract Modification Check', 'Digital contract checked for post-signing modifications', 'contract_v2.pdf', 'PDF', 'Multiple save timestamps after signature date', 'analyzed', 'high', 88.7],
      ['Medical Record Integrity', 'Patient medical record file integrity check', 'patient_record.pdf', 'PDF', 'No tampering indicators found', 'analyzed', 'low', 5.2],
      ['Drone Footage Metadata', 'Military drone footage metadata verification', 'drone_footage.mp4', 'MP4', 'Telemetry data gaps, encoding anomalies', 'analyzed', 'high', 79.8],
      ['Financial Statement PDF', 'Annual report PDF metadata forensics', 'annual_report.pdf', 'PDF', 'Producer field shows editing software', 'analyzed', 'medium', 56.4],
      ['Email Header Analysis', 'Phishing email header metadata trace', 'email_headers.eml', 'EML', 'Forged sender domain, routing anomalies', 'analyzed', 'critical', 94.6],
      ['Social Media Image EXIF', 'Instagram photo EXIF data for geolocation', 'insta_photo.jpg', 'JPEG', 'EXIF stripped but embedded GPS in XMP', 'analyzed', 'medium', 67.1],
      ['Firmware Image Check', 'IoT device firmware integrity verification', 'firmware_v3.bin', 'BIN', 'Hash mismatch with vendor published hash', 'analyzed', 'critical', 99.1],
      ['Audio Recording Metadata', 'Court audio recording metadata validation', 'court_audio.wav', 'WAV', 'Consistent metadata, no editing traces', 'analyzed', 'low', 8.9],
      ['Satellite Image Check', 'Satellite image timestamp and sensor validation', 'satellite.tiff', 'TIFF', 'Sensor calibration data inconsistent', 'analyzed', 'medium', 63.5],
      ['Blockchain Certificate', 'Digital certificate metadata on blockchain', 'certificate.json', 'JSON', 'Valid blockchain anchor, timestamp verified', 'analyzed', 'low', 3.2],
      ['Video Conference Record', 'Zoom recording metadata analysis', 'zoom_meeting.mp4', 'MP4', 'Multiple splicing points detected', 'analyzed', 'high', 85.3],
      ['Government Memo Check', 'Classified memo metadata forensics', 'memo_classified.pdf', 'PDF', 'Print driver inconsistent with stated origin', 'analyzed', 'high', 87.9],
      ['Research Paper Verify', 'Academic paper originality metadata check', 'research_paper.pdf', 'PDF', 'Creation date predates cited references', 'analyzed', 'medium', 72.4],
    ];
    for (const s of metadataAnalyses) {
      await pool.query(
        'INSERT INTO metadata_analyses (title, description, file_name, file_type, tampering_indicators, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, 1)',
        s
      );
    }
    console.log('Seeded 15 metadata analyses');

    // Seed Batch Scans (15)
    const batchScans = [
      ['Election Day Media Sweep', 'Batch scan of all media content from election day coverage', 'Election Media Batch', 2500, 2500, 47, 'image+video', 'completed', 'high', 78.5],
      ['Corporate Leak Investigation', 'Scanning leaked corporate documents for manipulation', 'Corp Leak Batch', 156, 156, 12, 'document', 'completed', 'medium', 65.3],
      ['Social Media Bot Hunt', 'Scanning suspected bot network profile images', 'Bot Network Scan', 10000, 9847, 8234, 'image', 'completed', 'critical', 94.2],
      ['News Outlet Verification', 'Weekly scan of major news outlet content', 'News Weekly Scan', 5000, 5000, 23, 'mixed', 'completed', 'low', 15.6],
      ['Insurance Claims Batch', 'Monthly batch scan of submitted insurance claim photos', 'Insurance Monthly', 890, 890, 34, 'image', 'completed', 'medium', 52.7],
      ['Celebrity Content Sweep', 'Scanning for non-consensual celebrity deepfakes', 'Celebrity Sweep', 3400, 2100, 189, 'image+video', 'analyzing', 'high', null],
      ['Government ID Verification', 'Batch verification of government ID submissions', 'Gov ID Batch', 15000, 15000, 67, 'image', 'completed', 'medium', 48.9],
      ['Academic Paper Scan', 'Scanning submitted academic papers for AI-generated images', 'Academic Batch', 450, 450, 78, 'document+image', 'completed', 'high', 81.3],
      ['Dark Web Monitoring Batch', 'Weekly dark web content scan for deepfake markets', 'Dark Web Weekly', 780, 780, 234, 'mixed', 'completed', 'critical', 96.1],
      ['Video Platform Audit', 'YouTube content audit for deepfake detection', 'YouTube Audit', 2000, 1456, 89, 'video', 'analyzing', 'medium', null],
      ['Financial Report Scan', 'Quarterly scan of financial documents', 'Finance Q4 Scan', 320, 320, 5, 'document', 'completed', 'low', 22.4],
      ['Military Intel Scan', 'Batch analysis of intelligence imagery', 'MilIntel Batch', 500, 500, 43, 'image', 'completed', 'high', 76.8],
      ['Healthcare Image Batch', 'Batch verification of telemedicine images', 'Healthcare Batch', 1200, 1200, 8, 'image', 'completed', 'low', 12.1],
      ['Real Estate Listing Scan', 'Scanning property listing images for AI generation', 'RealEstate Scan', 6700, 6700, 445, 'image', 'completed', 'medium', 58.9],
      ['Campaign Material Audit', 'Political campaign material deepfake audit', 'Campaign Audit', 890, 670, 56, 'mixed', 'analyzing', 'high', null],
    ];
    for (const s of batchScans) {
      await pool.query(
        'INSERT INTO batch_scans (title, description, batch_name, total_files, completed_files, flagged_files, scan_type, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 1)',
        s
      );
    }
    console.log('Seeded 15 batch scans');

    // Seed Realtime Monitors (15)
    const realtimeMonitors = [
      ['Twitter/X Election Feed', 'Monitoring Twitter/X for election-related deepfakes', 'X-Election-Monitor', 'https://x.com/feed/election', 'social_media', 85.0, true, null, 23, 'active', 'medium', 72.5],
      ['CNN Live Broadcast', 'Real-time CNN broadcast deepfake detection', 'CNN-Live-Guard', 'https://cnn.com/live', 'broadcast', 90.0, true, null, 5, 'active', 'low', 15.2],
      ['YouTube Trending', 'Monitoring YouTube trending for viral deepfakes', 'YT-Trending-Watch', 'https://youtube.com/trending', 'video_platform', 80.0, true, null, 12, 'active', 'medium', 45.8],
      ['Facebook Political Ads', 'Scanning Facebook political advertisements', 'FB-Political-Ads', 'https://facebook.com/ads/political', 'social_media', 75.0, true, null, 34, 'alert', 'high', 81.3],
      ['Reddit Front Page', 'Monitoring Reddit front page for manipulated media', 'Reddit-FP-Monitor', 'https://reddit.com/r/all', 'social_media', 70.0, true, null, 8, 'active', 'low', 28.4],
      ['Telegram Channels', 'Monitoring known disinformation Telegram channels', 'Telegram-DisInfo', 'telegram://channels/watchlist', 'messaging', 60.0, true, null, 67, 'alert', 'critical', 94.7],
      ['TikTok Viral Feed', 'TikTok viral content deepfake monitoring', 'TikTok-Viral', 'https://tiktok.com/discover', 'video_platform', 85.0, true, null, 19, 'active', 'medium', 56.3],
      ['Instagram Explore', 'Instagram explore page monitoring', 'IG-Explore-Watch', 'https://instagram.com/explore', 'social_media', 75.0, false, null, 3, 'paused', 'low', 12.7],
      ['WhatsApp Forward Chain', 'Monitoring WhatsApp viral forwarded content', 'WhatsApp-Forward', 'whatsapp://forward-monitor', 'messaging', 65.0, true, null, 45, 'alert', 'high', 83.6],
      ['Government Press Feeds', 'Monitoring official government press releases', 'Gov-Press-Guard', 'https://gov.feeds/press', 'official', 95.0, true, null, 1, 'active', 'low', 5.4],
      ['Dark Web Forums', 'Monitoring dark web deepfake creation forums', 'DarkWeb-Forum', 'tor://darkweb.forum', 'dark_web', 50.0, true, null, 89, 'alert', 'critical', 97.8],
      ['LinkedIn Content', 'Professional network deepfake content monitoring', 'LinkedIn-Content', 'https://linkedin.com/feed', 'social_media', 80.0, true, null, 7, 'active', 'low', 21.5],
      ['Wire Service Monitor', 'AP/Reuters wire service content verification', 'WireService-Guard', 'https://ap.news/wire', 'news_wire', 95.0, true, null, 2, 'active', 'low', 8.3],
      ['Podcast Platform Scan', 'Monitoring podcast platforms for AI-generated voices', 'Podcast-Voice', 'https://podcasts.monitor', 'audio_platform', 70.0, false, null, 11, 'paused', 'medium', 47.2],
      ['Stock Media Sites', 'Monitoring stock photo/video sites for AI content', 'StockMedia-Watch', 'https://stockmedia.monitor', 'marketplace', 75.0, true, null, 156, 'alert', 'high', 76.9],
    ];
    for (const s of realtimeMonitors) {
      await pool.query(
        'INSERT INTO realtime_monitors (title, description, monitor_name, source_url, monitor_type, alert_threshold, is_active, last_alert, alerts_count, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, 1)',
        s
      );
    }
    console.log('Seeded 15 realtime monitors');

    // Seed Election Verifications (15)
    const electionVerifications = [
      ['Presidential Debate Clip', 'Viral clip showing candidate making false statement', 'video', 'Sen. John Mitchell', 'Democratic', 'analyzed', 'debunked', 'critical', 97.5],
      ['Campaign Rally Speech', 'Audio of controversial rally speech', 'audio', 'Gov. Sarah Palmer', 'Republican', 'analyzed', 'verified', 'low', 8.3],
      ['Ballot Box Footage', 'Surveillance footage alleging ballot stuffing', 'video', 'N/A', 'N/A', 'analyzed', 'manipulated', 'critical', 96.2],
      ['Candidate Health Report', 'Leaked medical document about candidate health', 'document', 'Rep. Michael Torres', 'Independent', 'analyzed', 'inconclusive', 'medium', 52.7],
      ['Social Media Post', 'Screenshot of deleted social media post by candidate', 'image', 'Sen. Lisa Chang', 'Democratic', 'analyzed', 'fabricated', 'high', 89.4],
      ['TV Interview Clip', 'Interview clip showing candidate contradicting record', 'video', 'Gov. Robert Hayes', 'Republican', 'analyzed', 'authentic', 'low', 12.1],
      ['Robocall Recording', 'AI-generated robocall mimicking election official', 'audio', 'Election Commissioner', 'N/A', 'analyzed', 'confirmed_fake', 'critical', 99.1],
      ['Voter Registration Form', 'Mass-circulated voter registration form authenticity', 'document', 'N/A', 'N/A', 'analyzed', 'legitimate', 'low', 4.5],
      ['Endorsement Video', 'Celebrity endorsement video for candidate', 'video', 'Sen. Maria Gonzalez', 'Democratic', 'pending', 'unverified', 'medium', null],
      ['Poll Worker Training', 'Video of alleged poll worker misconduct', 'video', 'N/A', 'N/A', 'analyzed', 'manipulated', 'high', 84.6],
      ['Campaign Donation Receipt', 'Foreign donation receipt screenshot', 'image', 'Rep. James Park', 'Republican', 'analyzed', 'fabricated', 'high', 91.3],
      ['Debate Moderator Audio', 'Audio of debate moderator giving biased questions', 'audio', 'Debate Commission', 'N/A', 'analyzed', 'authentic', 'low', 7.8],
      ['Mail-in Ballot Image', 'Image of pre-filled mail-in ballots', 'image', 'N/A', 'N/A', 'analyzed', 'ai_generated', 'critical', 98.4],
      ['Concession Speech', 'Deep faked concession speech video', 'video', 'Gov. Sarah Palmer', 'Republican', 'analyzed', 'confirmed_fake', 'critical', 99.7],
      ['Voter Intimidation Flyer', 'Digital flyer with false voting information', 'image', 'N/A', 'N/A', 'analyzed', 'confirmed_fake', 'high', 88.2],
    ];
    for (const s of electionVerifications) {
      await pool.query(
        'INSERT INTO election_verifications (title, description, content_type, politician_name, party, status, verification_status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, 1)',
        s
      );
    }
    console.log('Seeded 15 election verifications');

    // Seed Social Media Scans (15)
    const socialMediaScans = [
      ['Twitter Bot Network Alpha', 'Large-scale bot network spreading deepfake content', 'Twitter/X', '@bot_network_001', 'video', 45000, 12.5, 'analyzed', 'critical', 96.8],
      ['Instagram Influencer Fake', 'Influencer using AI-generated face', 'Instagram', '@beauty_guru_fake', 'image', 2500000, 8.3, 'analyzed', 'high', 91.2],
      ['Facebook Election Disinfo', 'Facebook group spreading election deepfakes', 'Facebook', 'Patriots for Truth', 'mixed', 150000, 15.7, 'analyzed', 'critical', 94.5],
      ['TikTok Celebrity Deepfake', 'Viral TikTok with deepfake celebrity', 'TikTok', '@celebrity_clips', 'video', 890000, 22.1, 'analyzed', 'high', 87.3],
      ['YouTube Conspiracy Channel', 'Channel posting AI-generated conspiracy content', 'YouTube', 'TruthRevealedTV', 'video', 340000, 6.8, 'analyzed', 'high', 82.6],
      ['Reddit AMA Impersonation', 'Fake AMA using AI-generated responses', 'Reddit', 'u/fake_celebrity_ama', 'text', 12000, 45.2, 'analyzed', 'medium', 67.4],
      ['LinkedIn Fake Executive', 'Fake executive profile with AI-generated headshot', 'LinkedIn', 'John Smith, VP', 'image', 5000, 3.2, 'analyzed', 'high', 89.7],
      ['Telegram Propaganda Channel', 'State-sponsored propaganda with deepfakes', 'Telegram', 'StateNewsDaily', 'mixed', 89000, 31.4, 'analyzed', 'critical', 97.3],
      ['Snapchat Filter Abuse', 'Misuse of face filters for identity fraud', 'Snapchat', '@snap_fraudster', 'image', 1200, 18.9, 'analyzed', 'medium', 58.2],
      ['Pinterest Fake Product', 'AI-generated product images on Pinterest', 'Pinterest', 'FakeProductShop', 'image', 8900, 7.6, 'analyzed', 'medium', 73.5],
      ['Twitter Political Operative', 'Coordinated inauthentic behavior network', 'Twitter/X', 'Multiple accounts', 'mixed', 0, 0.0, 'analyzing', 'high', null],
      ['Instagram Story Manipulation', 'Manipulated Instagram story screenshots', 'Instagram', '@news_expose', 'image', 67000, 11.3, 'analyzed', 'medium', 64.8],
      ['Facebook Marketplace Scam', 'AI-generated product photos in marketplace', 'Facebook', 'QuickDealShop', 'image', 450, 2.1, 'analyzed', 'medium', 71.2],
      ['YouTube News Impersonation', 'Channel impersonating major news network', 'YouTube', 'BBCWorldNewsOfficial', 'video', 23000, 9.4, 'analyzed', 'high', 86.1],
      ['WhatsApp Chain Message', 'Viral WhatsApp deepfake video spreading fear', 'WhatsApp', 'Group: Family Chat', 'video', 0, 0.0, 'analyzed', 'high', 83.9],
    ];
    for (const s of socialMediaScans) {
      await pool.query(
        'INSERT INTO social_media_scans (title, description, platform, account_name, content_type, followers_count, engagement_rate, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 1)',
        s
      );
    }
    console.log('Seeded 15 social media scans');

    // Seed API Keys (15)
    const apiKeys = [
      ['Production Scanner API', 'Main production scanning endpoint', 'prod-scanner', 'dfk_prod_a1b2c3d4e5f6g7h8i9j0', 'scan:read,scan:write,analyze', 10000, 4523, true, 'active', 'low', null],
      ['Government Portal Key', 'US Government deepfake reporting portal', 'gov-portal', 'dfk_gov_k1l2m3n4o5p6q7r8s9t0', 'scan:read,scan:write,analyze,admin', 50000, 12890, true, 'active', 'low', null],
      ['Enterprise Meta Key', 'Meta Platforms integration key', 'meta-enterprise', 'dfk_meta_u1v2w3x4y5z6a7b8c9d0', 'scan:read,scan:write,analyze,batch', 100000, 67234, true, 'active', 'low', null],
      ['Research Lab Key', 'MIT Media Lab research access', 'mit-research', 'dfk_mit_e1f2g3h4i5j6k7l8m9n0', 'scan:read,analyze', 5000, 2341, true, 'active', 'low', null],
      ['News Verification API', 'NewsGuard verification endpoint', 'newsguard-api', 'dfk_news_o1p2q3r4s5t6u7v8w9x0', 'scan:read,scan:write,analyze', 25000, 8976, true, 'active', 'low', null],
      ['Mobile App Key', 'Consumer mobile application key', 'mobile-app', 'dfk_mob_y1z2a3b4c5d6e7f8g9h0', 'scan:read,scan:write', 2000, 1567, true, 'active', 'low', null],
      ['Staging Environment', 'Staging environment testing key', 'staging-env', 'dfk_stg_i1j2k3l4m5n6o7p8q9r0', 'scan:read,scan:write,analyze,admin', 1000, 234, true, 'active', 'low', null],
      ['Election Commission', 'Federal Election Commission key', 'fec-commission', 'dfk_fec_s1t2u3v4w5x6y7z8a9b0', 'scan:read,scan:write,analyze,election', 75000, 34567, true, 'active', 'low', null],
      ['Interpol Integration', 'Interpol cybercrime division access', 'interpol-cyber', 'dfk_intl_c1d2e3f4g5h6i7j8k9l0', 'scan:read,scan:write,analyze,admin,law_enforcement', 200000, 89012, true, 'active', 'low', null],
      ['Deprecated v1 Key', 'Old v1 API key pending decommission', 'deprecated-v1', 'dfk_dep_m1n2o3p4q5r6s7t8u9v0', 'scan:read', 100, 0, false, 'inactive', 'medium', null],
      ['Partner: Google', 'Google DeepMind partnership key', 'google-deepmind', 'dfk_goog_w1x2y3z4a5b6c7d8e9f0', 'scan:read,scan:write,analyze,batch,research', 500000, 234567, true, 'active', 'low', null],
      ['Webhook Processor', 'Internal webhook processing key', 'webhook-proc', 'dfk_whk_g1h2i3j4k5l6m7n8o9p0', 'webhook:write,scan:read', 50000, 45678, true, 'active', 'low', null],
      ['Audit Service Key', 'Internal audit trail service', 'audit-service', 'dfk_aud_q1r2s3t4u5v6w7x8y9z0', 'audit:read,audit:write', 10000, 7890, true, 'active', 'low', null],
      ['Rate Limited Test', 'Rate limit testing key', 'rate-test', 'dfk_rate_a2b3c4d5e6f7g8h9i0j1', 'scan:read', 10, 10, true, 'rate_limited', 'high', null],
      ['Suspended Key', 'Key suspended due to suspicious activity', 'suspended-key', 'dfk_sus_k2l3m4n5o6p7q8r9s0t1', 'scan:read,scan:write,analyze', 25000, 24999, false, 'suspended', 'critical', null],
    ];
    for (const s of apiKeys) {
      await pool.query(
        'INSERT INTO api_keys (title, description, key_name, api_key, permissions, rate_limit, requests_today, is_active, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, 1)',
        s
      );
    }
    console.log('Seeded 15 API keys');

    // Seed Scan History (15)
    const scanHistory = [
      ['Presidential Image Scan #1247', 'Completed deepfake scan of presidential address image', 'image', 'president_address_2024.jpg', 'High confidence deepfake detected - facial inconsistencies', '2.3 sec', 'completed', 'critical', 97.5],
      ['CEO Video Analysis #1248', 'Video deepfake analysis of earnings call', 'video', 'earnings_call.mp4', 'Lip sync anomalies detected in 3 segments', '45.2 sec', 'completed', 'high', 88.4],
      ['Batch Scan #1249', 'Election day media batch scan completed', 'batch', 'Election Media Batch', '47 of 2500 files flagged for review', '15 min', 'completed', 'medium', 78.5],
      ['Audio Clone Check #1250', 'CEO voice clone detection analysis', 'audio', 'ceo_voice.wav', 'Voice synthesis patterns detected', '5.1 sec', 'completed', 'critical', 95.2],
      ['Face Swap Scan #1251', 'Political debate face swap detection', 'face_swap', 'candidate_debate.mp4', 'Confirmed face swap - DeepFaceLab signatures', '12.8 sec', 'completed', 'critical', 98.1],
      ['GAN Detection #1252', 'StyleGAN3 generated face identification', 'gan', 'gan_face_001.png', 'GAN fingerprint detected in frequency domain', '1.8 sec', 'completed', 'high', 92.4],
      ['Metadata Check #1253', 'Crime scene photo metadata analysis', 'metadata', 'crime_scene.jpg', 'EXIF data tampering confirmed', '0.9 sec', 'completed', 'critical', 91.5],
      ['Social Scan #1254', 'Twitter bot network profile analysis', 'social_media', 'bot_network_profiles.zip', '82% of profiles identified as AI-generated', '3 min', 'completed', 'critical', 96.8],
      ['Election Verify #1255', 'Presidential debate clip verification', 'election', 'debate_clip.mp4', 'Content confirmed as manipulated deepfake', '8.5 sec', 'completed', 'critical', 97.5],
      ['Realtime Alert #1256', 'Telegram channel deepfake alert triggered', 'realtime', 'telegram_content.mp4', 'Automated detection triggered - high confidence deepfake', '0.3 sec', 'completed', 'critical', 94.7],
      ['API Request #1257', 'External API scan request from NewsGuard', 'api', 'news_article_image.jpg', 'Image verified as authentic', '1.2 sec', 'completed', 'low', 8.3],
      ['Threat Intel Scan #1258', 'New deepfake tool signature scan', 'threat_intel', 'tool_signature_db', 'Updated 12 tool signatures in database', '2.1 sec', 'completed', 'medium', 67.4],
      ['Batch Video Scan #1259', 'YouTube trending video batch analysis', 'batch', 'youtube_trending_batch', '89 videos analyzed, 12 flagged', '8 min', 'completed', 'medium', 56.3],
      ['Quick Image Scan #1260', 'Insurance claim photo quick scan', 'image', 'damage_photo.jpg', 'Moderate manipulation indicators found', '1.5 sec', 'completed', 'medium', 56.7],
      ['Compliance Scan #1261', 'Monthly compliance scanning completed', 'compliance', 'compliance_batch_march', 'All systems within compliance parameters', '25 min', 'completed', 'low', 5.2],
    ];
    for (const s of scanHistory) {
      await pool.query(
        'INSERT INTO scan_history (title, description, scan_type, file_name, result_summary, scan_duration, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, 1)',
        s
      );
    }
    console.log('Seeded 15 scan history records');

    // Seed Threat Intelligence (15)
    const threatIntel = [
      ['DeepFaceLab v2.0 Campaign', 'Coordinated campaign using latest DeepFaceLab targeting US elections', 'state_sponsored', 'critical', 'OSINT Network', 'DFL v2.0 model signatures, specific encoding artifacts', 'Deploy updated detection models, notify election security teams', 'North America, Europe', 'active', 'critical', 98.5],
      ['Voice Clone Fraud Ring', 'Organized crime using voice cloning for banking fraud', 'organized_crime', 'high', 'FBI Cyber Division', 'Specific TTS model fingerprints, call routing patterns', 'Update voice auth systems, implement liveness detection', 'Global', 'active', 'high', 89.3],
      ['StyleGAN3 Profile Factory', 'Mass production of fake profiles using StyleGAN3', 'botnet', 'high', 'Meta Threat Intel', 'StyleGAN3 spectral signatures, batch generation metadata', 'Block known StyleGAN3 output signatures', 'Global', 'active', 'high', 91.7],
      ['Election Interference Op', 'Foreign state operation targeting local elections with deepfakes', 'state_sponsored', 'critical', 'NSA/CYBERCOM', 'Specific language model artifacts, IP ranges, timing patterns', 'Coordinate with election officials, deploy monitoring', 'Eastern Europe, USA', 'active', 'critical', 96.2],
      ['Ransomware + Deepfake Combo', 'New ransomware variant using deepfake CEO videos for social engineering', 'cybercrime', 'critical', 'CrowdStrike', 'Specific ransomware signatures combined with deepfake indicators', 'Update email filters, implement video verification protocols', 'Global', 'active', 'critical', 94.8],
      ['Cheap Deepfake Service', 'Dark web service offering $50 deepfakes for fraud', 'dark_market', 'medium', 'Dark Web Monitor', 'Service advertisements, sample outputs, payment traces', 'Monitor service, catalog output signatures', 'Global', 'monitoring', 'medium', 67.3],
      ['AI Disinformation Network', 'Network of AI-generated news sites with deepfake content', 'disinformation', 'high', 'EU DisinfoLab', 'Domain registration patterns, content generation timestamps', 'Report to domain registrars, update blocklists', 'Europe, Asia', 'active', 'high', 85.6],
      ['Corporate Espionage Tool', 'New tool enabling real-time face swapping for video calls', 'espionage', 'high', 'Mandiant', 'Software signatures, API call patterns', 'Update video conferencing security, implement liveness checks', 'Global', 'active', 'high', 88.1],
      ['Child Safety Threat', 'AI tools being used to generate CSAM material', 'exploitation', 'critical', 'NCMEC', 'Specific model outputs, distribution channels', 'Report to law enforcement, update detection models urgently', 'Global', 'active', 'critical', 99.2],
      ['Crypto Scam Deepfakes', 'Deepfake videos of Elon Musk promoting crypto scams', 'fraud', 'medium', 'Chainalysis', 'Specific deepfake generation tool, crypto wallet addresses', 'Flag on social platforms, track wallet addresses', 'Global', 'monitoring', 'medium', 72.4],
      ['Military Disinfo Campaign', 'Deepfake videos of military officials making false statements', 'state_sponsored', 'critical', 'NATO STRATCOM', 'Specific video compression artifacts, distribution timeline', 'Immediate debunking, coordinate with allied forces', 'Middle East, Europe', 'active', 'critical', 95.6],
      ['Insurance Fraud Network', 'Organized ring using AI to generate fake damage photos', 'organized_crime', 'medium', 'Insurance Fraud Bureau', 'Common AI generation artifacts in submitted photos', 'Update claims verification, deploy AI photo check', 'USA, UK', 'monitoring', 'medium', 63.8],
      ['Academic Fraud Ring', 'AI-generated research images in scientific publications', 'academic_fraud', 'medium', 'Research Integrity Alliance', 'GAN artifacts in microscopy and chart images', 'Alert journal editors, update submission screening', 'Global', 'active', 'medium', 71.5],
      ['Phishing Campaign Evolution', 'Phishing emails now include deepfake video attachments', 'cybercrime', 'high', 'Proofpoint', 'Email header patterns, video encoding signatures', 'Update email security, block video attachments from unknown sources', 'North America', 'active', 'high', 86.9],
      ['Emerging: Audio Deepfakes in Courts', 'Growing trend of deepfake audio being submitted as court evidence', 'legal_threat', 'high', 'Department of Justice', 'Common audio synthesis artifacts in submitted evidence', 'Implement mandatory audio verification for evidence', 'USA', 'emerging', 'high', 79.4],
    ];
    for (const s of threatIntel) {
      await pool.query(
        'INSERT INTO threat_intelligence (title, description, threat_type, severity, source, indicators, mitigation, affected_regions, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, 1)',
        s
      );
    }
    console.log('Seeded 15 threat intelligence records');

    // Seed Audit Logs (15)
    const auditLogs = [
      ['Admin Login', 'Admin user authenticated successfully', 'login', 'user', 1, 'admin@deepfake.ai', '192.168.1.100', 'logged', 'low', null],
      ['Image Scan Created', 'New image scan initiated for presidential address', 'create', 'image_scan', 1, 'analyst1@deepfake.ai', '192.168.1.101', 'logged', 'low', null],
      ['Batch Scan Executed', 'Election day media batch scan started', 'execute', 'batch_scan', 1, 'manager@deepfake.ai', '192.168.1.102', 'logged', 'low', null],
      ['API Key Generated', 'New production API key generated', 'create', 'api_key', 1, 'admin@deepfake.ai', '192.168.1.100', 'logged', 'medium', null],
      ['User Role Changed', 'User role upgraded from analyst to manager', 'update', 'user', 5, 'admin@deepfake.ai', '192.168.1.100', 'logged', 'medium', null],
      ['Threat Alert Created', 'Critical threat intelligence alert published', 'create', 'threat_intelligence', 1, 'gov.analyst@deepfake.ai', '10.0.1.50', 'logged', 'high', null],
      ['Failed Login Attempt', 'Multiple failed login attempts detected', 'login_failed', 'user', null, 'unknown@attack.com', '203.0.113.42', 'flagged', 'high', null],
      ['Data Export Requested', 'Bulk data export of scan results requested', 'export', 'scan_history', null, 'enterprise1@deepfake.ai', '172.16.0.55', 'logged', 'medium', null],
      ['Monitor Threshold Changed', 'Alert threshold lowered on election monitor', 'update', 'realtime_monitor', 1, 'analyst2@deepfake.ai', '192.168.1.103', 'logged', 'low', null],
      ['Suspicious API Usage', 'Unusual API call pattern detected from partner key', 'anomaly', 'api_key', 11, 'system', '0.0.0.0', 'flagged', 'high', null],
      ['Record Deleted', 'Scan history record deleted by admin', 'delete', 'scan_history', 15, 'admin@deepfake.ai', '192.168.1.100', 'logged', 'medium', null],
      ['System Configuration', 'OpenRouter model configuration updated', 'config', 'system', null, 'admin@deepfake.ai', '192.168.1.100', 'logged', 'low', null],
      ['Permission Denied', 'Unauthorized access attempt to admin panel', 'access_denied', 'admin_panel', null, 'intern@deepfake.ai', '192.168.1.110', 'flagged', 'high', null],
      ['Compliance Report Generated', 'Monthly compliance report auto-generated', 'generate', 'compliance_report', null, 'system', '0.0.0.0', 'logged', 'low', null],
      ['Emergency Shutdown', 'Emergency monitor shutdown triggered', 'emergency', 'realtime_monitor', 6, 'manager@deepfake.ai', '192.168.1.102', 'flagged', 'critical', null],
    ];
    for (const s of auditLogs) {
      await pool.query(
        'INSERT INTO audit_logs (title, description, action, entity_type, entity_id, user_email, ip_address, status, risk_level, confidence_score, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 1)',
        s
      );
    }
    console.log('Seeded 15 audit logs');

    console.log('\n✅ All seed data inserted successfully!');
    console.log('Default login: admin@deepfake.ai / password123');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seed();
