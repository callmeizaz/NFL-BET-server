import { authenticate } from '@loopback/authentication';
import { authorize } from '@loopback/authorization';
import { inject, service } from '@loopback/core';
import { Filter, FilterExcludingWhere, repository } from '@loopback/repository';
import { del, get, getModelSchemaRef, HttpErrors, param, patch, post, requestBody } from '@loopback/rest';
import { SecurityBindings, securityId } from '@loopback/security';
import { Bet, Contest, Gain } from '@src/models';
import {
    BetRepository,
    ContestRepository,
    GainRepository,
    PlayerRepository,
    PlayerResultRepository,
    UserRepository,
} from '@src/repositories';
import { ContestPayoutService, ContestService, PaymentGatewayService, UserService } from '@src/services';
import {
    API_ENDPOINTS,
    CONTEST_STAKEHOLDERS,
    CONTEST_STATUSES,
    EMAIL_TEMPLATES,
    LOBBY_SPREAD_LIMIT,
    PERMISSIONS,
    TIMEZONE,
    PLAYER_POSITIONS,
} from '@src/utils/constants';
import { ErrorHandler, MiscHelpers } from '@src/utils/helpers';
import { AuthorizationHelpers } from '@src/utils/helpers/authorization.helpers';
import {
    ICommonHttpResponse,
    IContestClaimRequest,
    IContestCreateRequest,
    ICustomUserProfile,
} from '@src/utils/interfaces';
import { COMMON_MESSAGES, CONTEST_MESSAGES, PLAYER_MESSAGES } from '@src/utils/messages';
import { CONTEST_CLAIM_VALIDATOR, CONTEST_CREATE_VALIDATORS } from '@src/utils/validators';
import { isEmpty } from 'lodash';
import Schema from 'validate';
import fs from 'fs';
import moment from 'moment';
import momenttz from 'moment-timezone';

export class ContestController {
    constructor(
        @repository(ContestRepository)
        public contestRepository: ContestRepository,
        @repository(BetRepository)
        public betRepository: BetRepository,
        @repository(PlayerRepository)
        public playerRepository: PlayerRepository,
        @repository(PlayerResultRepository)
        public playerResultRepository: PlayerResultRepository,
        @repository(UserRepository)
        public userRepository: UserRepository,
        @repository(GainRepository) private gainRepository: GainRepository,
        @service() private paymentGatewayService: PaymentGatewayService,
        @service() private contestPayoutService: ContestPayoutService,
        @service() private contestService: ContestService,
        @service() private userService: UserService,
    ) {}

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.CREATE_ANY_CONTEST)] })
    @post(API_ENDPOINTS.CONTESTS.CRUD, {
        responses: {
            '200': {
                description: 'Contest model instance',
                content: {
                    'application/json': {
                        schema: {
                            message: { type: 'string' },
                            data: {
                                myContests: { type: 'array', items: getModelSchemaRef(Contest) },
                                contests: { type: 'array', items: getModelSchemaRef(Contest) },
                            },
                        },
                    },
                },
            },
        },
    })
    async create(
        @requestBody()
        body: Partial<IContestCreateRequest>,
        @inject(SecurityBindings.USER) currentUser: ICustomUserProfile,
    ): Promise<ICommonHttpResponse<any>> {
        if (!body || isEmpty(body)) throw new HttpErrors.BadRequest(COMMON_MESSAGES.MISSING_OR_INVALID_BODY_REQUEST);

        if (!body.creatorId) body.creatorId = +currentUser[securityId];

        const validationSchema = {
            creatorId: CONTEST_CREATE_VALIDATORS.creatorId,
            creatorPlayerId: CONTEST_CREATE_VALIDATORS.creatorPlayerId,
            claimerPlayerId: CONTEST_CREATE_VALIDATORS.claimerPlayerId,
            entryAmount: CONTEST_CREATE_VALIDATORS.entryAmount,
            winBonus: CONTEST_CREATE_VALIDATORS.winBonus,
        };

        const validation = new Schema(validationSchema, { strip: true });
        const validationErrors = validation.validate(body);
        if (validationErrors.length) throw new HttpErrors.BadRequest(ErrorHandler.formatError(validationErrors));

        const isPlayerAvailable = await this.contestService.checkPlayerStatus(
            body.creatorPlayerId ? body.creatorPlayerId : 0,
            body.claimerPlayerId ? body.claimerPlayerId : 0,
        );
        if (!isPlayerAvailable) throw new HttpErrors.BadRequest(COMMON_MESSAGES.PLAYER_NOT_AVAILABLE);

        const user = await this.userRepository.findById(body.creatorId);

        const funds = await this.paymentGatewayService.getTopPropBalance(user.id);
        const entryAmount = body.entryAmount ? body.entryAmount * 100 : 0;
        if (funds < entryAmount) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.INSUFFICIENT_BALANCE);

        const winBonusFlag = false;
        const creatorPlayerId = body.creatorPlayerId || 0;
        const claimerPlayerId = body.claimerPlayerId || 0;

        const creatorPlayerData = await this.playerRepository.findById(creatorPlayerId);
        if (!creatorPlayerData) throw new HttpErrors.BadRequest(PLAYER_MESSAGES.PLAYER_NOT_FOUND);
        const claimerPlayerData = await this.playerRepository.findById(claimerPlayerId);
        if (!claimerPlayerData) throw new HttpErrors.BadRequest(PLAYER_MESSAGES.PLAYER_NOT_FOUND);

        const creatorPlayerSpread = await this.contestService.calculateSpread(
            creatorPlayerId,
            claimerPlayerId,
            'creator',
        );
        const claimerPlayerSpread = await this.contestService.calculateSpread(
            creatorPlayerId,
            claimerPlayerId,
            'claimer',
        );

        const creatorPlayerCover = await this.contestService.calculateCover(
            creatorPlayerSpread,
            entryAmount,
            winBonusFlag,
        );
        const claimerPlayerCover = await this.contestService.calculateCover(
            claimerPlayerSpread,
            entryAmount,
            winBonusFlag,
        );

        const creatorPlayerWinBonus = winBonusFlag
            ? await this.contestService.calculateWinBonus(creatorPlayerSpread, entryAmount)
            : 0;
        const claimerPlayerWinBonus = winBonusFlag
            ? await this.contestService.calculateWinBonus(claimerPlayerSpread, entryAmount)
            : 0;

        const creatorPlayerProjFantasyPoints = creatorPlayerData ? creatorPlayerData.projectedFantasyPointsHalfPpr : 0;
        const claimerPlayerProjFantasyPoints = claimerPlayerData ? claimerPlayerData.projectedFantasyPointsHalfPpr : 0;

        const creatorPlayerMaxWin = Number(creatorPlayerCover) + Number(creatorPlayerWinBonus);
        const claimerPlayerMaxWin = Number(claimerPlayerCover) + Number(claimerPlayerWinBonus);

        const spreadValue = entryAmount * 0.85;
        const mlValue = entryAmount - spreadValue;

        const contestData = new Contest();
        const userId = body.creatorId;

        contestData.creatorId = userId;
        contestData.creatorPlayerId = creatorPlayerId;
        contestData.claimerPlayerId = claimerPlayerId;
        contestData.entryAmount = entryAmount;
        contestData.creatorPlayerProjFantasyPoints = creatorPlayerProjFantasyPoints;
        contestData.claimerPlayerProjFantasyPoints = claimerPlayerProjFantasyPoints;
        contestData.creatorPlayerCover = creatorPlayerCover;
        contestData.claimerPlayerCover = claimerPlayerCover;
        contestData.creatorPlayerMaxWin = creatorPlayerMaxWin;
        contestData.claimerPlayerMaxWin = claimerPlayerMaxWin;
        contestData.creatorPlayerWinBonus = creatorPlayerWinBonus;
        contestData.claimerPlayerWinBonus = claimerPlayerWinBonus;
        contestData.creatorPlayerSpread = creatorPlayerSpread;
        contestData.claimerPlayerSpread = claimerPlayerSpread;
        contestData.spreadValue = spreadValue;
        contestData.mlValue = mlValue;
        contestData.status = CONTEST_STATUSES.OPEN;
        contestData.ended = false;

        const createdContest = await this.contestRepository.create(contestData);

        const bet = new Bet();

        bet.contenderId = creatorPlayerId;
        bet.userId = userId;
        bet.amount = entryAmount;
        bet.contestId = createdContest.id;

        await this.betRepository.create(bet);

        const myContestFilter = {
            where: {
                and: [
                    { ended: false },
                    { or: [{ creatorId: userId }, { claimerId: userId }] },
                    {
                        or: [
                            { status: CONTEST_STATUSES.OPEN },
                            { status: CONTEST_STATUSES.MATCHED },
                            { status: CONTEST_STATUSES.UNMATCHED },
                        ],
                    },
                ],
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };

        const contestFilter = {
            where: {
                status: CONTEST_STATUSES.OPEN,
                ended: false,
                creatorId: { neq: userId },
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };
        const myContests = await this.contestRepository.find(myContestFilter);
        const contests = await this.contestRepository.find(contestFilter);

        return {
            message: CONTEST_MESSAGES.CREATE_SUCCESS,
            data: {
                myContests: myContests,
                contests: contests,
            },
        };
    }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.CREATE_ANY_CONTEST)] })
    @patch(API_ENDPOINTS.CONTESTS.CRUD, {
        responses: {
            '200': {
                description: 'Contest model instance',
                content: {
                    'application/json': {
                        schema: {
                            message: { type: 'string' },
                            data: {
                                myContests: { type: 'array', items: getModelSchemaRef(Contest) },
                                contests: { type: 'array', items: getModelSchemaRef(Contest) },
                            },
                        },
                    },
                },
            },
        },
    })
    async claim(
        @requestBody()
        body: Partial<IContestClaimRequest>,
        @inject(SecurityBindings.USER) currentUser: ICustomUserProfile,
    ): Promise<ICommonHttpResponse<any>> {
        if (!body || isEmpty(body)) throw new HttpErrors.BadRequest(COMMON_MESSAGES.MISSING_OR_INVALID_BODY_REQUEST);

        if (!body.claimerId) body.claimerId = +currentUser[securityId];

        const validationSchema = {
            contestId: CONTEST_CLAIM_VALIDATOR.contestId,
            claimerId: CONTEST_CLAIM_VALIDATOR.claimerId,
        };

        const validation = new Schema(validationSchema, { strip: true });
        const validationErrors = validation.validate(body);
        if (validationErrors.length) throw new HttpErrors.BadRequest(ErrorHandler.formatError(validationErrors));

        const contestId = body.contestId || 0;
        const userId = body.claimerId || 0;
        const contestData = await this.contestRepository.findById(contestId);
        if (!contestData) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.CONTEST_NOT_FOUND);

        if (contestData.claimerId) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.CONTEST_ALREADY_MATCHED);

        const isPlayerAvailable = await this.contestService.checkPlayerStatus(
            contestData.creatorPlayerId ? contestData.creatorPlayerId : 0,
            contestData.claimerPlayerId ? contestData.claimerPlayerId : 0,
        );

        if (!isPlayerAvailable) throw new HttpErrors.BadRequest(COMMON_MESSAGES.PLAYER_NOT_AVAILABLE);

        const user = await this.userRepository.findById(userId);

        const funds = await this.paymentGatewayService.getTopPropBalance(user.id);
        const entryAmount = contestData.entryAmount || 0;
        if (funds < entryAmount) throw new HttpErrors.BadRequest(`${CONTEST_MESSAGES.INSUFFICIENT_BALANCE}`);

        contestData.claimerId = body.claimerId;
        contestData.status = CONTEST_STATUSES.MATCHED;

        const updatedContest = await this.contestRepository.updateById(contestId, contestData);

        const bet = new Bet();

        bet.contenderId = contestData.claimerPlayerId;
        bet.userId = userId;
        bet.amount = contestData.entryAmount;
        bet.contestId = contestId;

        await this.betRepository.create(bet);

        const myContestFilter = {
            where: {
                and: [
                    { ended: false },
                    { or: [{ creatorId: userId }, { claimerId: userId }] },
                    {
                        or: [
                            { status: CONTEST_STATUSES.OPEN },
                            { status: CONTEST_STATUSES.MATCHED },
                            { status: CONTEST_STATUSES.UNMATCHED },
                        ],
                    },
                ],
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };

        const contestFilter = {
            where: {
                status: CONTEST_STATUSES.OPEN,
                ended: false,
                creatorId: { neq: userId },
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };
        const myContests = await this.contestRepository.find(myContestFilter);
        const contests = await this.contestRepository.find(contestFilter);

        // const user = await this.userRepository.findById(userId);
        const creatorPlayer = await this.playerRepository.findById(contestData.creatorPlayerId);
        const claimerPlayer = await this.playerRepository.findById(contestData.claimerPlayerId);
        const creatorUser = await this.userRepository.findById(contestData.creatorId);

        await this.userService.sendEmail(creatorUser, EMAIL_TEMPLATES.CONTEST_CLAIMED_BY_CLAIMER, {
            creatorUser,
            claimerPlayer,
            creatorPlayer,
            user,
            contestData,
            moment: moment,
            c2d: MiscHelpers.c2d,
            text: {
                title: `${
                    creatorUser ? creatorUser.fullName : ''
                }, your TopProp contest has been claimed and is officially cleared for takeoff!`,
                subtitle: 'Good luck!',
            },
        });

        return {
            message: CONTEST_MESSAGES.CLAIM_SUCCESS,
            data: {
                myContests: myContests,
                contests: contests,
            },
        };
    }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.CREATE_ANY_CONTEST)] })
    @post(API_ENDPOINTS.CONTESTS.CLOSE, {
        responses: {
            '200': {
                description: 'Contest model instance',
                content: {
                    'application/json': {
                        schema: {
                            message: { type: 'string' },
                            data: {
                                myContests: { type: 'array', items: getModelSchemaRef(Contest) },
                                contests: { type: 'array', items: getModelSchemaRef(Contest) },
                            },
                        },
                    },
                },
            },
        },
    })
    async close(
        @requestBody()
        body: Partial<IContestClaimRequest>,
        @inject(SecurityBindings.USER) currentUser: ICustomUserProfile,
    ): Promise<ICommonHttpResponse<any>> {
        if (!body || isEmpty(body)) throw new HttpErrors.BadRequest(COMMON_MESSAGES.MISSING_OR_INVALID_BODY_REQUEST);

        const userId = +currentUser[securityId];

        const validationSchema = {
            contestId: CONTEST_CLAIM_VALIDATOR.contestId,
        };

        const validation = new Schema(validationSchema, { strip: true });
        const validationErrors = validation.validate(body);
        if (validationErrors.length) throw new HttpErrors.BadRequest(ErrorHandler.formatError(validationErrors));

        const contestId = body.contestId || 0;

        const contestData = await this.contestRepository.findById(contestId);
        if (!contestData) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.CONTEST_NOT_FOUND);

        if (contestData.claimerId) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.CONTEST_ALREADY_MATCHED);

        if (contestData.creatorId !== userId) throw new HttpErrors.BadRequest(CONTEST_MESSAGES.NOT_YOUR_CONTEST);

        const constestUpdateData = {
            topPropProfit: 0,
            status: CONTEST_STATUSES.CLOSED,
            ended: true,
            endedAt: moment(),
            winnerLabel: CONTEST_STAKEHOLDERS.UNMATCHED,
            creatorWinAmount: 0,
            claimerWinAmount: 0,
        };
        await this.contestRepository.updateById(contestId, constestUpdateData);

        const entryAmount = Number(contestData.entryAmount);

        const entryGain = new Gain();
        entryGain.contestType = 'battleground';
        entryGain.amount = Number(entryAmount);
        entryGain.userId = contestData.creatorId;
        // entryGain.contenderId = favorite.playerId;
        entryGain.contestId = contestId;
        await this.gainRepository.create(entryGain);

        const myContestFilter = {
            where: {
                and: [
                    { ended: false },
                    { or: [{ creatorId: userId }, { claimerId: userId }] },
                    {
                        or: [
                            { status: CONTEST_STATUSES.OPEN },
                            { status: CONTEST_STATUSES.MATCHED },
                            { status: CONTEST_STATUSES.UNMATCHED },
                        ],
                    },
                ],
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };

        const contestFilter = {
            where: {
                status: CONTEST_STATUSES.OPEN,
                ended: false,
                creatorId: { neq: userId },
            },
            include: ['creator', 'claimer', 'winner', 'creatorPlayer', 'claimerPlayer'],
        };
        const myContests = await this.contestRepository.find(myContestFilter);
        const contests = await this.contestRepository.find(contestFilter);

        return {
            message: CONTEST_MESSAGES.CLAIM_SUCCESS,
            data: {
                myContests: myContests,
                contests: contests,
            },
        };
    }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.VIEW_ALL_CONTESTS)] })
    @get(API_ENDPOINTS.CONTESTS.CRUD, {
        responses: {
            '200': {
                description: 'Array of Contest model instances',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: getModelSchemaRef(Contest, { includeRelations: true }),
                        },
                    },
                },
            },
        },
    })
    async find(@param.filter(Contest) filter?: Filter<Contest>): Promise<ICommonHttpResponse<Contest[]>> {
        return { data: await this.contestRepository.find(filter) };
    }

    // @patch(API_ENDPOINTS.CONTESTS.CRUD, {
    //     responses: {
    //         '200': {
    //             description: 'Contest PATCH success count',
    //             content: { 'application/json': { schema: CountSchema } },
    //         },
    //     },
    // })
    // async updateAll(
    //     @requestBody({
    //         content: {
    //             'application/json': {
    //                 schema: getModelSchemaRef(Contest, { partial: true }),
    //             },
    //         },
    //     })
    //     contest: Contest,
    //     @param.where(Contest) where?: Where<Contest>,
    // ): Promise<Count> {
    //     return this.contestRepository.updateAll(contest, where);
    // }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.VIEW_ANY_CONTEST)] })
    @get(API_ENDPOINTS.CONTESTS.BY_ID, {
        responses: {
            '200': {
                description: 'Contest model instance',
                content: {
                    'application/json': {
                        schema: getModelSchemaRef(Contest, { includeRelations: true }),
                    },
                },
            },
        },
    })
    async findById(
        @param.path.number('id') id: number,
        @param.filter(Contest, { exclude: 'where' }) filter?: FilterExcludingWhere<Contest>,
    ): Promise<ICommonHttpResponse<Contest>> {
        return { data: await this.contestRepository.findById(id, filter) };
    }

    // @patch(API_ENDPOINTS.CONTESTS.BY_ID, {
    //     responses: {
    //         '204': {
    //             description: 'Contest PATCH success',
    //         },
    //     },
    // })
    // async updateById(
    //     @param.path.number('id') id: number,
    //     @requestBody({
    //         content: {
    //             'application/json': {
    //                 schema: getModelSchemaRef(Contest, { partial: true }),
    //             },
    //         },
    //     })
    //     contest: Contest,
    // ): Promise<void> {
    //     await this.contestRepository.updateById(id, contest);
    // }

    // @put(API_ENDPOINTS.CONTESTS.BY_ID, {
    //     responses: {
    //         '204': {
    //             description: 'Contest PUT success',
    //         },
    //     },
    // })
    // async replaceById(@param.path.number('id') id: number, @requestBody() contest: Contest): Promise<void> {
    //     await this.contestRepository.replaceById(id, contest);
    // }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.DELETE_ANY_CONTEST)] })
    @del(API_ENDPOINTS.CONTESTS.BY_ID, {
        responses: {
            '204': {
                description: 'Contest DELETE success',
            },
        },
    })
    async deleteById(@param.path.number('id') id: number): Promise<void> {
        await this.contestRepository.deleteById(id);
    }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.CALCULATE_AMOUNTS)] })
    @post(API_ENDPOINTS.CONTESTS.CALCULATE_VALUES)
    async calculateValues(
        @requestBody()
        body: {
            playerId: number;
            opponentId: number;
            type: string;
            entry: number;
        },
    ): Promise<ICommonHttpResponse<object>> {
        const isPlayerAvailable = await this.contestService.checkPlayerStatus(body.playerId, body.opponentId);
        if (!isPlayerAvailable) throw new HttpErrors.BadRequest(COMMON_MESSAGES.PLAYER_NOT_AVAILABLE);

        const spread = await this.contestService.calculateSpread(body.playerId, body.opponentId, body.type);
        if (Math.abs(Number(spread)) > LOBBY_SPREAD_LIMIT)
            throw new HttpErrors.BadRequest(CONTEST_MESSAGES.SPREAD_TOO_LARGE);

        const entryAmount = body.entry ? body.entry * 100 : 0;
        const coverWithBonus = await this.contestService.calculateCover(spread, entryAmount, true);
        const coverWithoutBonus = await this.contestService.calculateCover(spread, entryAmount, false);

        const winBonus = await this.contestService.calculateWinBonus(spread, entryAmount);

        return {
            data: {
                withWinBonus: {
                    spread,
                    cover: coverWithBonus,
                    winBonus,
                },
                withoutWinBonus: {
                    spread,
                    cover: coverWithoutBonus,
                    winBonus: 0,
                },
            },
        };
    }

    @authenticate('jwt')
    @authorize({ voters: [AuthorizationHelpers.allowedByPermission(PERMISSIONS.CONTESTS.CREATE_ANY_CONTEST)] })
    @get(API_ENDPOINTS.CONTESTS.STATUS, {
        responses: {
            '200': {
                description: 'Run Cron Job',
            },
        },
    })
    async status(): Promise<ICommonHttpResponse<any>> {
        let status = 'active';

        const players = await this.playerRepository.find({
            where: {
                isOver: false,
                position: { inq: PLAYER_POSITIONS },
                projectedFantasyPointsHalfPpr: { gt: 2.9 },
                // id: { neq: firstPlayer?.id },
                available: true,
                status: 'Active',
            },
        });

        const rawData = fs.readFileSync('./src/utils/constants/schedule.week.json', 'utf8');
        const weeklyGames = JSON.parse(rawData);

        const currentTime = momenttz().tz(TIMEZONE).add(1, 'minute');
        // const currentTime = momenttz.tz('2021-11-30T20:30:00', TIMEZONE).add(1, 'minute');

        const currentDay = currentTime.day();

        const clonedCurrentTime = currentTime.clone();

        if (currentDay === 2) {
            const startOfMonday = clonedCurrentTime.startOf('day');

            const scheduledGames = weeklyGames.filter((game: { DateTime: number }) => {
                const gameDate = momenttz.tz(game.DateTime, TIMEZONE);
                return gameDate.isBetween(startOfMonday, currentTime, 'minute');
            });

            if (scheduledGames.length > 0) {
                status = 'mondayNightFootball';
            }
        }

        if (players.length === 0) {
            status = 'noPlayers';
        }

        return {
            // active, noPlayers, mondayNightFootball
            data: {
                status: status,
            },
        };
    }
}
