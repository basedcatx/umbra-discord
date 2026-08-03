import { Snowflake } from 'discord.js';
import { ActivityState, LifeStatus } from '../types/states';

export const PlayerFlags = {
  WasKilled: 1 << 0,
  WasSaved: 1 << 1,
  HasPerformedAction: 1 << 2,
  HasVoted: 1 << 3,
} as const;

export interface PlayerInterface {
  _id: string;
  _lifestatus: LifeStatus;
  _role: string;
  _isbot: boolean;
  _isafk: boolean;
  _username: string;
  _lastmessage: string | null;
  _flag: number;
  _activitystate: ActivityState;
}
// Every game mode must have a none player role

export class Player implements PlayerInterface {
  _id: string;
  _lifestatus: LifeStatus = LifeStatus.ALIVE;
  _role: string = 'none';
  _isbot: boolean = false;
  _isafk: boolean = true;
  _username: string;
  _lastmessage: string | null = null;
  _flag: number = 0;
  _activitystate: ActivityState = ActivityState.IDLE;

  public constructor(playerId: Snowflake, { username, isBot = false }: Readonly<{ username?: string; isBot?: boolean }>) {
    this._id = playerId;
    this._isbot = isBot;
    this._username = username || 'unknown';
  }

  static fromJSON(pJson: PlayerInterface): Player {
    const p = new Player(pJson._id, { username: pJson._username, isBot: pJson._isbot });
    p._lifestatus = pJson._lifestatus;
    p._activitystate = pJson._activitystate;
    p._flag = pJson._flag;
    p._role = pJson._role;
    p._lastmessage = pJson._lastmessage;
    p._isafk = pJson._isafk;
    return p;
  }

  public toJSON(): PlayerInterface {
    return {
      _id: this._id,
      _lifestatus: this._lifestatus,
      _role: this._role,
      _isafk: this._isafk,
      _isbot: this.isBot,
      _username: this._username,
      _lastmessage: this._lastmessage,
      _flag: this._flag,
      _activitystate: this._activitystate,
    };
  }

  public get isAfk(): boolean {
    return this._isafk;
  }

  public set isAfk(isAfk: boolean) {
    this._isafk = isAfk;
  }

  public get username(): string {
    return this._username;
  }

  public get isBot(): boolean {
    return this._isbot;
  }

  public get activityState() {
    return this._activitystate;
  }

  public set activityState(s: ActivityState) {
    this._activitystate = s;
  }

  public resetActivityState() {
    this._activitystate = ActivityState.IDLE;
  }

  public get lastMessage(): string | null {
    return this._lastmessage;
  }

  public consumeLastMessage() {
    const saved = this._lastmessage;
    this._lastmessage = null;
    return saved;
  }

  public set lastMessage(msg: string) {
    this._lastmessage = msg;
  }

  public get lifeStatus() {
    return this._lifestatus;
  }

  public set lifeStatus(ls: LifeStatus) {
    this._lifestatus = ls;
  }

  public get role() {
    return this._role;
  }

  public set role(role) {
    this._role = role;
  }

  public get id() {
    return this._id;
  }

  public has(flag: number) {
    return (this._flag & flag) === flag;
  }

  // Checks if player has all the specified flags (^)
  public hasAllFlags(flags: number[]) {
    return flags.every((flag) => this.has(flag));
  }

  public setFlag(flag: number) {
    this._flag |= flag;
  }

  public clearFlag(flag: number) {
    this._flag &= ~flag;
  }

  public toggleFlag(flag: number) {
    this._flag ^= flag;
  }

  public clearFlags() {
    this._flag = 0;
  }
}
