// Generated by https://quicktype.io

import {IStadiumDetails} from './stadium.interfaces';

export interface IRemoteScore {
    GameKey: string;
    PlayerID: number;
    SeasonType: number;
    Season: number;
    Week: number;
    Date: string;
    AwayTeam: string;
    HomeTeam: string;
    AwayScore: number;
    HomeScore: number;
    Channel: string;
    PointSpread: number;
    OverUnder: number;
    Quarter: string;
    TimeRemaining: null;
    Possession: null;
    Down: null;
    Distance: null;
    YardLine: null;
    YardLineTerritory: null;
    RedZone: null;
    AwayScoreQuarter1: number;
    AwayScoreQuarter2: number;
    AwayScoreQuarter3: number;
    AwayScoreQuarter4: number;
    AwayScoreOvertime: number;
    HomeScoreQuarter1: number;
    HomeScoreQuarter2: number;
    HomeScoreQuarter3: number;
    HomeScoreQuarter4: number;
    HomeScoreOvertime: number;
    HasStarted: boolean;
    Started: boolean;
    IsInProgress: boolean;
    IsGameOver: boolean;
    Has1stQuarterStarted: boolean;
    Has2ndQuarterStarted: boolean;
    Has3rdQuarterStarted: boolean;
    Has4thQuarterStarted: boolean;
    IsOvertime: boolean;
    DownAndDistance: null;
    QuarterDescription: string;
    StadiumID: number;
    LastUpdated: string;
    GeoLat: null;
    GeoLong: null;
    ForecastTempLow: number;
    ForecastTempHigh: number;
    ForecastDescription: string;
    ForecastWindChill: number;
    ForecastWindSpeed: number;
    AwayTeamMoneyLine: number;
    HomeTeamMoneyLine: number;
    Canceled: boolean;
    Closed: boolean;
    LastPlay: null;
    Day: string;
    DateTime: string;
    AwayTeamID: number;
    HomeTeamID: number;
    GlobalGameID: number;
    GlobalAwayTeamID: number;
    GlobalHomeTeamID: number;
    PointSpreadAwayTeamMoneyLine: number;
    PointSpreadHomeTeamMoneyLine: number;
    ScoreID: number;
    Status: string;
    GameEndDateTime: string;
    HomeRotationNumber: number;
    AwayRotationNumber: number;
    NeutralVenue: boolean;
    StadiumDetails: IStadiumDetails;
    FantasyPoints: number,
    FantasyPointsPPR: number,
}
export interface IDailyFantasyPointsData {
    PlayerID: number;
    Name: string;
    Team: string;
    Position: string;
    FantasyPoints: number;
    FantasyPointsPPR: number;
    FantasyPointsFanDuel: number;
    FantasyPointsDraftKings: number;
    FantasyPointsYahoo: number;
    HasStarted: boolean;
    IsInProgress: boolean;
    IsOver: boolean;
    Date: string;
    FantasyPointsFantasyDraft: null;
}

export interface IDailyFantasyPlayerData {
    PlayerID: number;
    Date: Date;
    ShortName: string;
    Name: string;
    Team: string;
    Opponent: string;
    HomeOrAway: string;
    Position: string | null;
    Salary: number;
    LastGameFantasyPoints: number;
    ProjectedFantasyPoints: number;
    OpponentRank: number;
    OpponentPositionRank: number;
    Status: string;
    StatusCode: string;
    StatusColor: string;
    FanDuelSalary: number;
    DraftKingsSalary: number;
    YahooSalary: number;
    FantasyDataSalary: number;
    FantasyDraftSalary: null;
}

export interface IProjectedHalfPprPlayerData {
    GameKey: number | string;
    PlayerID: number | string;
    SeasonType: number | string;
    Season: number | string;
    GameDate: string;
    Week: number | string;
    Team: string;
    Opponent: string;
    HomeOrAway: string;
    Number: number | string;
    Name: string;
    Position: string;
    PositionCategory: string;
    Activated: number | string | null;
    Played: number | string | null;
    Started: number | string | null;
    PassingAttempts: number | string | null;
    PassingCompletions: number | string | null;
    PassingYards: number | string | null;
    PassingCompletionPercentage: number | string | null;
    PassingYardsPerAttempt: number | string | null;
    PassingYardsPerCompletion: number | string | null;
    PassingTouchdowns: number | string | null;
    PassingInterceptions: number | string | null;
    PassingRating: number | string | null;
    PassingLong: number | string | null;
    PassingSacks: number | string | null;
    PassingSackYards: number | string | null;
    RushingAttempts: number | string | null;
    RushingYards: number | string | null;
    RushingYardsPerAttempt: number | string | null;
    RushingTouchdowns: number | string | null;
    RushingLong: number | string | null;
    ReceivingTargets: number | string | null;
    Receptions: number | string | null;
    ReceivingYards: number | string | null;
    ReceivingYardsPerReception: number | string | null;
    ReceivingTouchdowns: number | string | null;
    ReceivingLong: number | string | null;
    Fumbles: number | string | null;
    FumblesLost: number | string | null;
    PuntReturns: number | string | null;
    PuntReturnYards: number | string | null;
    PuntReturnYardsPerAttempt: number | string | null;
    PuntReturnTouchdowns: number | string | null;
    PuntReturnLong: number | string | null;
    KickReturns: number | string | null;
    KickReturnYards: number | string | null;
    KickReturnYardsPerAttempt: number | string | null;
    KickReturnTouchdowns: number | string | null;
    KickReturnLong: number | string | null;
    SoloTackles: number | string | null;
    AssistedTackles: number | string | null;
    TacklesForLoss: number | string | null;
    Sacks: number | string | null;
    SackYards: number | string | null;
    QuarterbackHits: number | string | null;
    PassesDefended: number | string | null;
    FumblesForced: number | string | null;
    FumblesRecovered: number | string | null;
    FumbleReturnYards: number | string | null;
    FumbleReturnTouchdowns: number | string | null;
    Interceptions: number | string | null;
    InterceptionReturnYards: number | string | null;
    InterceptionReturnTouchdowns: number | string | null;
    BlockedKicks: number | string | null;
    SpecialTeamsSoloTackles: number | string | null;
    SpecialTeamsAssistedTackles: number | string | null;
    MiscSoloTackles: number | string | null;
    MiscAssistedTackles: number | string | null;
    Punts: number | string | null;
    PuntYards: number | string | null;
    PuntAverage: number | string | null;
    FieldGoalsAttempted: number | string | null;
    FieldGoalsMade: number | string | null;
    FieldGoalsLongestMade: number | string | null;
    ExtraPointsMade: number | string | null;
    TwoPointConversionPasses: number | string | null;
    TwoPointConversionRuns: number | string | null;
    TwoPointConversionReceptions: number | string | null;
    FantasyPoints: number ;
    FantasyPointsPPR: number;
    ReceptionPercentage: number | string | null;
    ReceivingYardsPerTarget: number | string | null;
    Tackles: number | string | null;
    OffensiveTouchdowns: number | string | null;
    DefensiveTouchdowns: number | string | null;
    SpecialTeamsTouchdowns: number | string | null;
    Touchdowns: number | string | null;
    FantasyPosition: string;
    FieldGoalPercentage: number | string | null;
    PlayerGameID: string | number | null;
    FumblesOwnRecoveries: number | string | null;
    FumblesOutOfBounds: number | string | null;
    KickReturnFairCatches: number | string | null;
    PuntReturnFairCatches: number | string | null;
    PuntTouchbacks: number | string | null;
    PuntInside20: number | string | null;
    PuntNetAverage: number | string | null;
    ExtraPointsAttempted: number | string | null;
    BlockedKickReturnTouchdowns: number | string | null;
    FieldGoalReturnTouchdowns: number | string | null;
    Safeties: number | string | null;
    FieldGoalsHadBlocked: number | string | null;
    PuntsHadBlocked: number | string | null;
    ExtraPointsHadBlocked: number | string | null;
    PuntLong: number | string | null;
    BlockedKickReturnYards: number | string | null;
    FieldGoalReturnYards: number | string | null;
    PuntNetYards: number | string | null;
    SpecialTeamsFumblesForced: number | string | null;
    SpecialTeamsFumblesRecovered: number | string | null;
    MiscFumblesForced: number | string | null;
    MiscFumblesRecovered: number | string | null;
    ShortName: string;
    PlayingSurface: string;
    IsGameOver: boolean;
    SafetiesAllowed: number | string | null;
    Stadium: string | number | null;
    Temperature: string | number | null;
    Humidity: string | number | null;
    WindSpeed: string | number | null;
    FanDuelSalary: number | string | null;
    DraftKingsSalary: number | string | null;
    FantasyDataSalary: number | string | null;
    OffensiveSnapsPlayed: string | number | null;
    DefensiveSnapsPlayed: string | number | null;
    SpecialTeamsSnapsPlayed: string | number | null;
    OffensiveTeamSnaps: string | number | null;
    DefensiveTeamSnaps: string | number | null;
    SpecialTeamsTeamSnaps: string | number | null;
    VictivSalary: string | number | null;
    TwoPointConversionReturns: number | string | null;
    FantasyPointsFanDuel: number;
    FieldGoalsMade0to19: number | string | null;
    FieldGoalsMade20to29: number | string | null;
    FieldGoalsMade30to39: number | string | null;
    FieldGoalsMade40to49: number | string | null;
    FieldGoalsMade50Plus: number | string | null;
    FantasyPointsDraftKings: number | string | null;
    YahooSalary: number | string | null;
    FantasyPointsYahoo: number;
    InjuryStatus: string | number | null;
    InjuryBodyPart: string | number | null;
    InjuryStartDate: string | number | null;
    InjuryNotes: string | number | null;
    FanDuelPosition: string | number | null;
    DraftKingsPosition: string | number | null;
    YahooPosition: string | number | null;
    OpponentRank: number | string | null;
    OpponentPositionRank: number | string | null;
    InjuryPractice: string | number | null;
    InjuryPracticeDescription: string | number | null;
    DeclaredInactive: false;
    FantasyDraftSalary: string | number | null;
    FantasyDraftPosition: string | number | null;
    TeamID: number | string | null;
    OpponentID: number | string | null;
    Day: string | number | null;
    DateTime: string | number | null;
    GlobalGameID: number | string | null;
    GlobalTeamID: number | string | null;
    GlobalOpponentID: number | string | null;
    ScoreID: number | string | null;
    FantasyPointsFantasyDraft: number | string | null;
    OffensiveFumbleRecoveryTouchdowns: string | number | null;
    ScoringDetails: []
}