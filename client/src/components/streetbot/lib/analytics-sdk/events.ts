// Typed namespaced event helpers. Use these in product code so call sites
// emit canonical event names with validated property shapes.
//
//   import { analytics } from '@local3180/analytics-client';
//   analytics.events.gallery.artworkUploaded({ artwork_id, medium, ... });
//
// For one-off events not covered here, fall back to `analytics.capture(name, props)`.

import type { AnalyticsClient } from './client';
import {
  classifyQuery,
  type ClassifyOptions,
  type QueryClassification,
} from './classifyQuery';
import {
  fileSizeBucket,
  lengthBucket,
  durationBucket,
  timeToReplyBucket,
  timeToCompleteBucket,
  unreadCountBucket,
  clampResultCount,
  scoreBucket,
  completenessBucket,
  rowCountBucket,
  priceBucket,
  radiusBucket,
} from './buckets';

export type EventNamespaces = ReturnType<typeof buildEvents>;

export function buildEvents(client: AnalyticsClient) {
  const cap = (n: string, p: Record<string, unknown> = {}) => client.capture(n, p);

  return {
    // -- Auth -------------------------------------------------------------
    auth: {
      signedUp:           (p: { signup_method: string; entry_point?: string }) => cap('auth_signed_up', p),
      loggedIn:           (p: { auth_method: string; is_returning?: boolean }) => cap('auth_logged_in', p),
      loggedOut:          () => cap('auth_logged_out', {}),
      gateShown:          (p: { feature: string; reason: string }) => cap('auth_gate_shown', p),
      featureAccessDenied:(p: { feature: string; user_role: string }) => cap('feature_access_denied', p),
    },

    // -- Home -------------------------------------------------------------
    home: {
      viewed:             (p: { feature_cards_visible?: number; quick_stats_visible?: boolean } = {}) => cap('home_viewed', p),
      featureClicked:     (p: { feature: string; destination: string }) => cap('home_feature_clicked', p),
    },

    // -- Street Profile ---------------------------------------------------
    profile: {
      directoryViewed:    (p: { result_count: number; filters_active: number; sort?: string; source?: string }) => cap('street_profile_directory_viewed', { ...p, result_count: clampResultCount(p.result_count) }),
      searchPerformed:    (p: { raw_query: string; result_count: number; filters_count?: number }) => {
        const cls = classifyQuery(p.raw_query, { surface: 'profile' });
        cap('street_profile_search_performed', {
          query_category:      cls.query_category,
          query_length_bucket: cls.query_length_bucket,
          result_count:        clampResultCount(p.result_count),
          filters_count:       p.filters_count ?? 0,
        });
      },
      createStarted:      (p: { entry_point?: string } = {}) => cap('street_profile_create_started', p),
      createStepCompleted:(p: { step: string; fields_completed_count: number }) => cap('street_profile_create_step_completed', p),
      created:            (p: { profile_type: string; completeness: number }) => cap('street_profile_created', { ...p, completeness_bucket: completenessBucket(p.completeness * 100) }),
      viewed:             (p: { viewed_profile_id: string; is_profile_owner: boolean; source?: string }) => cap('street_profile_viewed', p),
      tabViewed:          (p: { tab: string; viewed_profile_id: string; is_profile_owner: boolean }) => cap('street_profile_tab_viewed', p),
      ctaClicked:         (p: { cta: 'follow'|'message'|'share'|'save'|'book'|'website'; viewed_profile_id: string }) => cap('street_profile_cta_clicked', p),
      updated:            (p: { fields_updated: string[]; completeness_before: number; completeness_after: number }) => cap('street_profile_updated', p),
      avatarUploaded:     (p: { file_type: string; file_size_bytes: number }) => cap('street_profile_avatar_uploaded', { file_type: p.file_type, file_size_bucket: fileSizeBucket(p.file_size_bytes) }),
      bannerUploaded:     (p: { file_type: string; file_size_bytes: number }) => cap('street_profile_banner_uploaded', { file_type: p.file_type, file_size_bucket: fileSizeBucket(p.file_size_bytes) }),
      portfolioUpdated:   (p: { portfolio_item_count: number }) => cap('street_profile_portfolio_updated', p),
      bookingStarted:     (p: { service_id: string; viewed_profile_id: string }) => cap('street_profile_booking_started', p),
    },

    // -- AI ---------------------------------------------------------------
    ai: {
      chatStarted:        (p: { entry_point: string; conversation_type?: string }) => cap('ai_chat_started', p),
      messageSent:        (p: { message_chars: number; has_attachment: boolean; agent_team: string }) => cap('ai_message_sent', { agent_team: p.agent_team, has_attachment: p.has_attachment, message_length_bucket: lengthBucket(p.message_chars) }),
      responseReceived:   (p: { latency_ms: number; agent_team: string; tool_count: number; model: string }) => cap('ai_response_received', p),
      toolCalled:         (p: { tool_name: string; agent_name: string; latency_ms: number; success: boolean }) => cap('ai_tool_called', p),
      serviceResultsShown:(p: { result_count: number; category?: string }) => cap('ai_service_results_shown', { ...p, result_count: clampResultCount(p.result_count) }),
      serviceClicked:     (p: { service_id: string; position: number; source?: string }) => cap('ai_service_clicked', p),
      feedbackSubmitted:  (p: { rating: 'up' | 'down'; feedback_type?: string }) => cap('ai_feedback_submitted', p),
      errorSeen:          (p: { error_code: string; agent_name?: string; route?: string }) => cap('ai_error_seen', p),
    },

    // -- Directory --------------------------------------------------------
    directory: {
      viewed:             (p: { view_mode: 'list' | 'map'; city?: string; has_location?: boolean }) => cap('directory_viewed', p),
      searchPerformed:    (p: { raw_query: string; result_count: number; filters_count?: number; surface?: ClassifyOptions['surface'] }) => {
        const cls: QueryClassification = classifyQuery(p.raw_query, { surface: p.surface ?? 'directory' });
        cap('directory_search_performed', {
          query_category:      cls.query_category,
          query_length_bucket: cls.query_length_bucket,
          result_count:        clampResultCount(p.result_count),
          filters_count:       p.filters_count ?? 0,
        });
      },
      filterChanged:      (p: { filter_type: string; selected_count: number }) => cap('directory_filter_changed', p),
      noResultsSeen:      (p: { raw_query: string; filters?: string[] }) => {
        const cls = classifyQuery(p.raw_query, { surface: 'directory' });
        cap('directory_no_results_seen', { query_category: cls.query_category, filters: p.filters });
      },
      mapViewed:          (p: { result_count: number; radius_km?: number }) => cap('directory_map_viewed', { result_count: clampResultCount(p.result_count), radius_bucket: p.radius_km != null ? radiusBucket(p.radius_km) : null }),
      serviceImpression:  (p: { service_id: string; position: number; list_type: string }) => cap('directory_service_impression', p),
      serviceViewed:      (p: { service_id: string; source?: string; position?: number }) => cap('directory_service_viewed', p),
      serviceActionClicked:(p: { service_id: string; action: 'call'|'directions'|'website'|'email'|'share'|'ask_ai' }) => cap('directory_service_action_clicked', p),
      serviceSaved:       (p: { service_id: string; source?: string }) => cap('directory_service_saved', p),
      reviewSubmitted:    (p: { service_id: string; rating: number }) => cap('directory_review_submitted', p),
      claimStarted:       (p: { service_id: string; source?: string }) => cap('directory_listing_claim_started', p),
      claimCompleted:     (p: { service_id: string; provider_type: string }) => cap('directory_listing_claim_completed', p),
    },

    // -- Gallery ----------------------------------------------------------
    gallery: {
      viewed:             (p: { view_mode: string; filters_count?: number; result_count?: number }) => cap('gallery_viewed', { ...p, result_count: p.result_count != null ? clampResultCount(p.result_count) : undefined }),
      searchPerformed:    (p: { raw_query: string; result_count: number }) => {
        const cls = classifyQuery(p.raw_query, { surface: 'gallery' });
        cap('gallery_search_performed', { query_category: cls.query_category, query_length_bucket: cls.query_length_bucket, result_count: clampResultCount(p.result_count) });
      },
      filterChanged:      (p: { filter_type: string; value_bucket?: string }) => cap('gallery_filter_changed', p),
      artworkImpression:  (p: { artwork_id: string; artist_profile_id: string; position: number }) => cap('gallery_artwork_impression', p),
      artworkViewed:      (p: { artwork_id: string; artist_profile_id: string; source?: string }) => cap('gallery_artwork_viewed', p),
      artworkFavorited:   (p: { artwork_id: string; artist_profile_id: string }) => cap('gallery_artwork_favorited', p),
      artworkCommented:   (p: { artwork_id: string; comment_type: 'top_level' | 'reply' }) => cap('gallery_artwork_commented', p),
      artworkShared:      (p: { artwork_id: string; share_method: string }) => cap('gallery_artwork_shared', p),
      artistProfileClicked:(p: { artist_profile_id: string; source_artwork_id: string }) => cap('gallery_artist_profile_clicked', p),
      uploadStarted:      (p: { entry_point?: string; has_street_profile: boolean }) => cap('gallery_upload_started', p),
      uploadBlocked:      (p: { reason: 'auth_required' | 'profile_required' | 'validation_error' }) => cap('gallery_upload_blocked', p),
      artworkUploaded:    (p: { medium: string; style?: string; tags_count: number; is_for_sale: boolean; accepts_commissions?: boolean }) => cap('gallery_artwork_uploaded', p),
      artworkPriceUpdated:(p: { artwork_id: string; price: number; currency: string }) => cap('gallery_artwork_price_updated', { artwork_id: p.artwork_id, price_bucket: priceBucket(p.price), currency: p.currency }),
      artworkMarkedSold:  (p: { artwork_id: string; price: number }) => cap('gallery_artwork_marked_sold', { artwork_id: p.artwork_id, price_bucket: priceBucket(p.price) }),
      dashboardViewed:    (p: { artist_profile_id: string; artwork_count: number }) => cap('gallery_dashboard_viewed', p),
    },

    // -- Jobs -------------------------------------------------------------
    jobs: {
      boardViewed:        (p: { saved_filter?: string; result_count: number }) => cap('jobs_board_viewed', { ...p, result_count: clampResultCount(p.result_count) }),
      searchPerformed:    (p: { raw_query: string; result_count: number; filters_count?: number }) => {
        const cls = classifyQuery(p.raw_query, { surface: 'jobs' });
        cap('jobs_search_performed', { query_category: cls.query_category, query_length_bucket: cls.query_length_bucket, result_count: clampResultCount(p.result_count), filters_count: p.filters_count ?? 0 });
      },
      filterChanged:      (p: { filter_type: string; selected_count: number }) => cap('jobs_filter_changed', p),
      jobImpression:      (p: { job_id: string; position: number; is_featured: boolean; work_mode: string }) => cap('jobs_job_impression', p),
      jobViewed:          (p: { job_id: string; source?: string; position?: number }) => cap('jobs_job_viewed', p),
      jobSaved:           (p: { job_id: string; source?: string }) => cap('jobs_job_saved', p),
      jobShared:          (p: { job_id: string; share_method: string }) => cap('jobs_job_shared', p),
      applicationStarted: (p: { job_id: string; has_resume: boolean; quick_apply_available?: boolean }) => cap('jobs_application_started', p),
      applicationSubmitted:(p: { job_id: string; submission_type: string; docs_count: number; cover_note_used?: boolean }) => cap('jobs_application_submitted', p),
      externalApplyClicked:(p: { job_id: string; employer_verified: boolean }) => cap('jobs_external_apply_clicked', p),
      applicationWithdrawn:(p: { job_id: string; status_before: string }) => cap('jobs_application_withdrawn', p),
      resumeStarted:      (p: { entry_point?: string } = {}) => cap('jobs_resume_started', p),
      resumeCompleted:    (p: { completeness_score: number; sections_count: number }) => cap('jobs_resume_completed', { completeness_score_bucket: completenessBucket(p.completeness_score), sections_count: p.sections_count }),
      resumeUploaded:     (p: { file_type: string; file_size_bytes: number }) => cap('jobs_resume_uploaded', { file_type: p.file_type, file_size_bucket: fileSizeBucket(p.file_size_bytes) }),
      coverLetterGenerated:(p: { job_id: string; template_type: string }) => cap('jobs_cover_letter_generated', p),
      employerListingDraftStarted: (p: { entry_point?: string } = {}) => cap('jobs_employer_listing_draft_started', p),
      employerListingPublished: (p: { job_id: string; category: string; work_mode: string; inclusive_flags_count: number }) => cap('jobs_employer_listing_published', p),
      applicantStatusChanged: (p: { job_id: string; from_status: string; to_status: string }) => cap('jobs_applicant_status_changed', p),
    },

    // -- Academy ----------------------------------------------------------
    academy: {
      homeViewed:         (p: { role: 'learner' | 'instructor' | 'unknown' }) => cap('academy_home_viewed', p),
      pathViewed:         (p: { path_id: string; source?: string }) => cap('academy_path_viewed', p),
      courseViewed:       (p: { course_id: string; instructor_profile_id?: string }) => cap('academy_course_viewed', p),
      courseSaved:        (p: { course_id: string }) => cap('academy_course_saved', p),
      enrollmentStarted:  (p: { course_id: string; path_id?: string }) => cap('academy_enrollment_started', p),
      enrollmentCompleted:(p: { course_id: string; path_id?: string }) => cap('academy_enrollment_completed', p),
      lessonStarted:      (p: { course_id: string; lesson_id: string }) => cap('academy_lesson_started', p),
      lessonCompleted:    (p: { course_id: string; lesson_id: string; time_spent_ms: number }) => cap('academy_lesson_completed', p),
      videoProgressed:    (p: { lesson_id: string; milestone: 25|50|75|100; playback_speed?: number }) => cap('academy_video_progressed', p),
      assignmentSubmitted:(p: { assignment_id: string; course_id: string }) => cap('academy_assignment_submitted', p),
      quizStarted:        (p: { quiz_id: string; course_id: string }) => cap('academy_quiz_started', p),
      quizCompleted:      (p: { quiz_id: string; score_percent: number; passed: boolean }) => cap('academy_quiz_completed', { quiz_id: p.quiz_id, score_bucket: scoreBucket(p.score_percent), passed: p.passed }),
      liveSessionJoined:  (p: { session_id: string; course_id: string }) => cap('academy_live_session_joined', p),
      certificateEarned:  (p: { certificate_id: string; course_id: string }) => cap('academy_certificate_earned', p),
      aiTutorUsed:        (p: { course_id: string; lesson_id: string; helpful?: boolean }) => cap('academy_ai_tutor_used', p),
    },

    // -- Messages ---------------------------------------------------------
    messages: {
      pageViewed:         (p: { channel_type: string; unread_count: number }) => cap('messages_page_viewed', { channel_type: p.channel_type, unread_count_bucket: unreadCountBucket(p.unread_count) }),
      channelJoined:      (p: { channel_id: string; channel_type: string }) => cap('messages_channel_joined', p),
      dmStarted:          (p: { source?: string; recipient_profile_type: string }) => cap('messages_dm_started', p),
      messageSent:        (p: { channel_type: string; has_attachment?: boolean; has_voice?: boolean; message_chars: number }) => cap('messages_message_sent', { channel_type: p.channel_type, has_attachment: !!p.has_attachment, has_voice: !!p.has_voice, length_bucket: lengthBucket(p.message_chars) }),
      replyReceived:      (p: { channel_type: string; time_to_reply_ms: number }) => cap('messages_reply_received', { channel_type: p.channel_type, time_to_reply_bucket: timeToReplyBucket(p.time_to_reply_ms) }),
      reactionAdded:      (p: { channel_type: string; reaction_type: string }) => cap('messages_reaction_added', p),
      threadOpened:       (p: { channel_type: string; reply_count: number }) => cap('messages_thread_opened', { channel_type: p.channel_type, reply_count_bucket: unreadCountBucket(p.reply_count) }),
      attachmentUploaded: (p: { file_type: string; file_size_bytes: number }) => cap('messages_attachment_uploaded', { file_type: p.file_type, file_size_bucket: fileSizeBucket(p.file_size_bytes) }),
      voiceMessageSent:   (p: { duration_ms: number; transcription_success?: boolean }) => cap('messages_voice_message_sent', { duration_bucket: durationBucket(p.duration_ms), transcription_success: !!p.transcription_success }),
      callStarted:        (p: { call_type: 'audio' | 'video'; source?: string }) => cap('messages_call_started', p),
      callCompleted:      (p: { call_type: 'audio' | 'video'; duration_ms: number }) => cap('messages_call_completed', { call_type: p.call_type, duration_bucket: durationBucket(p.duration_ms) }),
      notificationClicked:(p: { notification_type: string; destination: string }) => cap('messages_notification_clicked', p),
    },

    // -- Tasks ------------------------------------------------------------
    tasks: {
      pageViewed:         (p: { view_mode: string; project_id?: string }) => cap('tasks_page_viewed', p),
      projectCreated:     (p: { source?: string } = {}) => cap('tasks_project_created', p),
      taskCreated:        (p: { project_id: string; list_id?: string; source?: string }) => cap('tasks_task_created', p),
      taskCompleted:      (p: { project_id: string; priority: string; time_to_complete_ms: number }) => cap('tasks_task_completed', { project_id: p.project_id, priority: p.priority, time_to_complete_bucket: timeToCompleteBucket(p.time_to_complete_ms) }),
      taskMoved:          (p: { project_id: string; from_status: string; to_status: string; method: 'drag'|'menu'|'automation' }) => cap('tasks_task_moved', p),
      filterChanged:      (p: { filter_type: string; selected_count: number }) => cap('tasks_filter_changed', p),
      bulkActionPerformed:(p: { action: string; selected_count: number }) => cap('tasks_bulk_action_performed', p),
      automationCreated:  (p: { trigger: string; actions_count: number }) => cap('tasks_automation_created', p),
      templateUsed:       (p: { template_id: string }) => cap('tasks_template_used', p),
      importCompleted:    (p: { source: string; row_count: number }) => cap('tasks_import_completed', { source: p.source, row_count_bucket: rowCountBucket(p.row_count) }),
      milestoneCreated:   (p: { project_id: string }) => cap('tasks_milestone_created', p),
      analyticsViewed:    (p: { project_id: string; x_axis: string }) => cap('tasks_analytics_viewed', p),
    },

    // -- News -------------------------------------------------------------
    news: {
      homeViewed:         (p: { source?: string } = {}) => cap('news_home_viewed', p),
      articleViewed:      (p: { article_id: string; category?: string; source?: string }) => cap('news_article_viewed', p),
      articleRead:        (p: { article_id: string; read_time_ms: number; scroll_depth_percent: number }) => cap('news_article_read', { article_id: p.article_id, read_time_ms: Math.min(p.read_time_ms, 1_800_000), scroll_depth_percent: Math.min(100, p.scroll_depth_percent) }),
      articleShared:      (p: { article_id: string; share_method: string }) => cap('news_article_shared', p),
      bookmarkAdded:      (p: { article_id: string }) => cap('news_bookmark_added', p),
      dashboardViewed:    (p: { draft_count: number; published_count: number }) => cap('news_dashboard_viewed', p),
      draftCreated:       (p: { source: 'manual' | 'ai' }) => cap('news_draft_created', p),
      aiGenerationStarted:(p: { generation_type: string }) => cap('news_ai_generation_started', p),
      aiGenerationCompleted:(p: { generation_type: string; latency_ms: number; success: boolean }) => cap('news_ai_generation_completed', p),
    },

    // -- Documents --------------------------------------------------------
    documents: {
      pageViewed:         (p: { workspace_id: string; view_mode: string; section?: string }) => cap('documents_page_viewed', p),
      created:            (p: { workspace_id: string; source?: string }) => cap('documents_document_created', p),
      opened:             (p: { document_id: string; workspace_id: string; source?: string }) => cap('documents_document_opened', p),
      edited:             (p: { document_id: string; edit_session_ms: number }) => cap('documents_document_edited', p),
      shared:             (p: { document_id: string; share_type: string }) => cap('documents_document_shared', p),
      commented:          (p: { document_id: string }) => cap('documents_document_commented', p),
      exported:           (p: { document_id: string; format: string }) => cap('documents_document_exported', p),
      folderCreated:      (p: { workspace_id: string }) => cap('documents_folder_created', p),
      searchPerformed:    (p: { result_count: number; scope: string }) => cap('documents_search_performed', { result_count: clampResultCount(p.result_count), scope: p.scope }),
    },

    // -- Generic page wrapper for callers that want explicit invocation. --
    page: {
      viewed:             (p: { route?: string; route_pattern?: string } = {}) => {
        // For most callers, page_entered is fired automatically by the page
        // tracker. This helper exists only for Edge cases (e.g. modal-as-route)
        // where the host wants to assert a page view.
        cap('page_entered', { route: p.route ?? location.pathname, route_pattern: p.route_pattern ?? location.pathname });
      },
    },
  };
}
