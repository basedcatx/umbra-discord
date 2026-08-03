//seconds
export const MAX_PLAYER_IN_GAME = 20;
export const MIN_PLAYER_IN_GAME = 3;
export const LOBBY_BASE_DURATION = 60;
export const LOBBY_MAX_RETRY_COUNT = 2;
export const PHASE_CHANGE_DURATION = 30;
export const PHASE_UPDATE_DURATION = 1;
export const SLEEP_DURATION = 3;
export const POLL_DURATION = 15;

export const enum MENU_IDS {
  SELECT_PERFORM_ACTION_MENU = 'select_perform_action_menu',
  VOTE_USER_MENU = 'vote_user_select_menu',
}

export const enum BTN_IDS {
  JOIN_LOBBY_BUTTON = 'join_lobby_button',
  LEAVE_LOBBY_BUTTON = 'leave_lobby_button',
  START_LOBBY_GAME_BUTTON = 'start_lobby_game',
  COUNT_BUTTON = 'count',
  ASSIGN_ROLE_BTN = 'assign_role_btn',
  PERFORM_ACTION_BTN = 'perform_action_btn',
  CHECK_LIFE_STATUS_BTN = 'check_life_status_btn',
  LAST_MESSAGE_BTN = 'last_message_btn',
  CHECK_GAME_TIME_BTN = 'check_game_time_btn',
  VOTE_SKIP_BUTTON = 'vote_skip_button',
  PLACEHOLDER = 'placeholder_button',
}
