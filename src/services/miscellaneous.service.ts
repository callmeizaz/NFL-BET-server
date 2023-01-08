import { bind, BindingScope, service } from '@loopback/core';
import { repository } from '@loopback/repository';
import { Gain, User, TopUp } from '@src/models';
import Dwolla from 'dwolla-v2';
import {
    BetRepository,
    TopUpRepository,
    ContestRepository,
    CouponCodeRepository,
    GainRepository,
    PlayerRepository,
    UserRepository,
    WithdrawRequestRepository,
    PaymentGatewayEventRepository,
} from '@src/repositories';
import { ContestService, CronService } from '@src/services';
import chalk from 'chalk';
import moment from 'moment';
import { isEqual } from 'lodash';
import { CONTEST_STATUSES, CONTEST_STAKEHOLDERS, WITHDRAW_REQUEST_STATUSES } from '../utils/constants';
import logger from '../utils/logger';

@bind({ scope: BindingScope.SINGLETON })
export class MiscellaneousService {
    dwollaClient: Dwolla.Client;
    private dwollaApiUrl: string;
    constructor(
        @repository(PlayerRepository) private playerRepository: PlayerRepository,
        @repository(GainRepository) private gainRepository: GainRepository,
        @repository(ContestRepository) private contestRepository: ContestRepository,
        @repository('CouponCodeRepository') private couponCodeRepository: CouponCodeRepository,
        @repository('UserRepository') private userRepository: UserRepository,
        @repository('WithdrawRequestRepository') private withdrawRequestRepository: WithdrawRequestRepository,
        @repository('BetRepository') private betRepository: BetRepository,
        @repository('TopUpRepository') private topUpRepository: TopUpRepository,
        @repository('PaymentGatewayEventRepository')
        private paymentGatewayEventRepository: PaymentGatewayEventRepository,
        @service() private contestService: ContestService,
        @service() private cronServie: CronService,
    ) {}

    async resetIncorrectlyGradedContests() {
        /*
        Date: 1-10-2021
        Description: This was run to reset contests that were
        incorrectly graded because of not coercing data
        fetched from the DB to a number before comparison */

        console.log('contests');

        const sql =
            "select id from contest where ended=true and claimerid is not null and ((creatorplayerfantasypoints + creatorplayerspread > claimerplayerfantasypoints and winnerlabel='claimer') or (creatorplayerfantasypoints + creatorplayerspread < claimerplayerfantasypoints and winnerlabel='creator'))";

        const contests = await this.contestRepository.execute(sql, null, null);

        const contestIds = contests.map((contest: { id: number }) => contest.id);

        if (contestIds.length > 0) {
            logger.info(chalk.redBright(`Contests that were graded incorrectly are `, contestIds));

            // const gains = await this.gainRepository.find({
            //     where: {
            //         contestId: { inq: contestIds },

            //     },
            // });

            await this.gainRepository.deleteAll({
                contestId: { inq: contestIds },
                contestType: 'battleground',
            });

            const constestData = {
                winnerId: null,
                topPropProfit: 0,
                status: CONTEST_STATUSES.MATCHED,
                ended: false,
                endedAt: null,
                winnerLabel: null,
                creatorWinAmount: null,
                claimerWinAmount: null,
                creatorPlayerFantasyPoints: 0,
                claimerPlayerFantasyPoints: 0,
            };

            // @ts-ignore
            await this.contestRepository.updateAll(constestData, { id: { inq: contestIds } });
        }
    }

    async resetNoPPRGradedContests() {
        /*
        Date: 1-10-2021
        Description: This was run to reset contests that were
        graded according to noPPR logic instead of halfPPR */

        const sql =
            "select id from contest where ended=true and claimerid is not null and createdat > '2021-10-27 00:00:00'";

        const contests = await this.contestRepository.execute(sql, null, null);

        const contestIds = contests.map((contest: { id: number }) => contest.id);

        if (contestIds.length > 0) {
            logger.info(chalk.redBright(`Contests that were graded incorrectly are `, contestIds));

            // const gains = await this.gainRepository.find({
            //     where: { contestId: { inq: contestIds }, contestType: 'battleground' },
            // });

            await this.gainRepository.deleteAll({
                contestId: { inq: contestIds },
                contestType: 'battleground',
            });

            const constestData = {
                winnerId: null,
                topPropProfit: 0,
                status: CONTEST_STATUSES.MATCHED,
                ended: false,
                endedAt: null,
                winnerLabel: null,
                creatorWinAmount: null,
                claimerWinAmount: null,
                creatorPlayerFantasyPoints: 0,
                claimerPlayerFantasyPoints: 0,
            };

            // @ts-ignore
            await this.contestRepository.updateAll(constestData, { id: { inq: contestIds } });
        }
    }

    // misc crons services
    async addPromoCode() {
        /* Date: 1-11-2021
        Description: Added Promo code for Freedman90 for $10 on 15-11-21
        Description: Added Promo code for BeatFreedman for $25 on 01-12-21 */

        const PromoCodeArr = [
            { code: '#BeatFreedman', amount: 2500 },
            { code: 'Beat Freedman', amount: 2500 },
            { code: 'BeatFreedman', amount: 2500 },
        ];

        // check for coupon ,if doesn't exists create one
        PromoCodeArr.map(async ({ code, amount }) => {
            const couponData = await this.couponCodeRepository.find({
                where: {
                    code: code,
                },
            });
            if (!couponData.length) {
                const promoData = {
                    code: code,
                    value: amount,
                };
                await this.couponCodeRepository.create(promoData);
            }
        });
    }

    async updateDOB() {
        /*
        Date: 4-11-2021
        Description: Updates the DOB of parker@carbonfoxdesigns.com to 9/11/1984
        Description: Updates the DOB of cbcrating@yahoo.com to 8/6/1975 */

        const dob = new Date('1975-08-06 00:00:00');
        const formattedDob = moment(dob).format('YYYY-MM-DD HH:mm:ss');

        const user = await this.userRepository.findOne({
            where: {
                email: 'cbcrating@yahoo.com',
            },
        });

        if (user) {
            await this.userRepository.updateById(user?.id, { dateOfBirth: formattedDob });
        }
    }

    async resetAllPlayers() {
        /*
        Date: 10-11-2021
        Description: Resets all player info. Recreates the logic used in fetch player reset functionality

        Reused
        - 2021-11-24
        - 2021-12-01
        - 2021-12-29
        - 2022-01-12
        - 2022-02-03
        */
        this.playerRepository.updateAll(
            {
                isOver: false,
                hasStarted: false,
                projectedFantasyPoints: 0,
                projectedFantasyPointsHalfPpr: 0,
                lastUpdateFrom: 'resetAllPlayers in miscellaneous.service.ts',
            },
            { id: { gt: 0 } },
            (err: any, info: any) => {},
        );
    }

    // update the users who had signed up with freedman90 and got bonusPayoutProcessed to true
    async updateBonusPayoutProcessed() {
        this.userRepository.updateAll(
            { bonusPayoutProcessed: false },
            { promo: { ilike: 'freedman90' } },
            (err: any, info: any) => {},
        );
    }

    async makeAllPlayersAvailable() {
        /*
        Date: 24-11-2021
        Description: Resets all player hasStarted and isOver flag.
        */

        this.playerRepository.updateAll(
            { isOver: false, hasStarted: false, lastUpdateFrom: 'makeAllPlayersAvailable in miscellaneous.service.ts' },
            { id: { gt: 0 } },
            (err: any, info: any) => {},
        );
        logger.info(`Misc cron ran successfully. hasStarted and isOver flag for all players reset successfully`);
    }

    async regradeInjuredPlayersBattlegroundContests() {
        /*
        Date: 07-12-2021
        Description: Resets all contests that were incorrectly graded because the void contest did not get called.
        */

        console.log('contests');

        const sql =
            "SELECT * FROM contest where createdat > '2021-11-30 01:00:00' and (claimerplayerid in(select id From player where projectedFantasypointshalfppr=0) or creatorplayerid in(select id From player where projectedFantasypointshalfppr=0)) and winnerid is not null;";

        const contests = await this.contestRepository.execute(sql, null, null);

        const contestIds = contests.map((contest: { id: number }) => contest.id);

        if (contestIds.length > 0) {
            logger.info(chalk.redBright(`Contests that were graded incorrectly are `, contestIds));

            await this.gainRepository.deleteAll({
                contestId: { inq: contestIds },
                contestType: 'battleground',
            });

            const constestData = {
                winnerId: null,
                topPropProfit: 0,
                status: CONTEST_STATUSES.CLOSED,
                ended: true,
                winnerLabel: CONTEST_STAKEHOLDERS.PUSH,
                creatorWinAmount: 0,
                claimerWinAmount: 0,
            };

            // @ts-ignore
            await this.contestRepository.updateAll(constestData, { id: { inq: contestIds } });

            contestIds.map(async (contestId: number) => {
                const contestData = await this.contestRepository.findById(contestId);

                const entryAmount = Number(contestData.entryAmount);

                const entryGain = new Gain();
                entryGain.contestType = 'battleground';
                entryGain.amount = Number(entryAmount);
                entryGain.userId = contestData.creatorId;
                // entryGain.contenderId = underdog.playerId;
                entryGain.contestId = contestId;

                await this.gainRepository.create(entryGain);

                entryGain.contestType = 'battleground';
                entryGain.amount = Number(entryAmount);
                entryGain.userId = contestData.claimerId;
                // entryGain.contenderId = favorite.playerId;
                entryGain.contestId = contestId;

                await this.gainRepository.create(entryGain);
            });
        }
    }

    // Reject withdraw Request
    async rejectWithdrawRequest() {
        /* Date:241-12-2021
        triplike@outlook.com
         */

        const EmailArr = ['triplike@outlook.com'];

        // check for coupon ,if doesn't exists create one
        EmailArr.map(async email => {
            const user = await this.userRepository.findOne({
                where: {
                    email: email,
                },
            });

            if (user) {
                const withdrawRequests = await this.withdrawRequestRepository.findOne({
                    where: {
                        status: WITHDRAW_REQUEST_STATUSES.PENDING,
                        userId: user.id,
                    },
                    include: [
                        {
                            relation: 'user',
                        },
                    ],
                });

                if (withdrawRequests) {
                    const updateData = {
                        paid: false,
                        payoutId: null,
                        paidAt: null,
                        transferred: false,
                        withdrawTransferUrl: null,
                        transferredAt: null,
                    };

                    const whereUpdate = {
                        withdrawRequestId: withdrawRequests.id,
                    };

                    const withdrawUpdateData = { status: WITHDRAW_REQUEST_STATUSES.DENIED };

                    const withdrawWhereUpdate = {
                        id: withdrawRequests.id,
                    };

                    if (updateData && whereUpdate && withdrawUpdateData && withdrawWhereUpdate) {
                        await this.betRepository.updateAll(updateData, whereUpdate);
                        await this.gainRepository.updateAll(updateData, whereUpdate);
                        await this.topUpRepository.updateAll(updateData, whereUpdate);
                        await this.withdrawRequestRepository.updateAll(withdrawUpdateData, withdrawWhereUpdate);
                    }
                }
            }
        });
    }

    // Sync Missed Deposits
    async syncMissedDeposits() {
        /* Date:29-12-2021
         */

        const emails = ['brekucki10@gmail.com', 'jcadogan09@gmail.com', 'leo.s.weiss@icloud.com', 'texascj@gmail.com'];

        if (!process.env.DWOLLA_APP_KEY || !process.env.DWOLLA_APP_SECRET)
            throw new Error(`Must provide dwolla env variables`);

        this.dwollaClient = new Dwolla.Client({
            key: process.env.DWOLLA_APP_KEY,
            secret: process.env.DWOLLA_APP_SECRET,
            environment: isEqual(process.env.DWOLLA_ENV, 'production') ? 'production' : 'sandbox', // defaults to 'production'
        });

        this.dwollaApiUrl = isEqual(process.env.DWOLLA_ENV, 'production')
            ? 'https://api.dwolla.com'
            : 'https://api-staging.dwolla.com';

        const users = await this.userRepository.find({
            where: {
                email: { inq: emails },
            },
        });
        let today = new Date();
        let yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        await Promise.all(
            users
                .filter(user => user._customerTokenUrl)
                .map(async (user: User) => {
                    const response = await this.dwollaClient.get(`${user._customerTokenUrl}/transfers`);
                    const transactions = response.body._embedded['transfers'];

                    logger.info(`transactions ${JSON.stringify(transactions)}`);

                    transactions
                        .filter(
                            (transfer: any) =>
                                transfer._links &&
                                transfer._links.source['resource-type'] !== 'account' &&
                                transfer._links.destination['resource-type'] !== 'customer',
                        )
                        .map(async (transfer: any) => {
                            if (
                                transfer._links?.source['resource-type'] === 'customer' &&
                                transfer._links?.destination['resource-type'] === 'funding-source'
                            ) {
                                console.log('in here');
                            } else if (transfer.id && transfer._links && transfer.status === 'processed') {
                                const transferURL = transfer._links.self.href;

                                const topUp = await this.topUpRepository.findOne({
                                    where: { topUpTransferUrl: transferURL },
                                });

                                if (!topUp) {
                                    const eventId = transfer.id;
                                    const amount = transfer.amount.value;
                                    logger.info(
                                        `An add funds transaction with transfer id:  ${eventId} of amount $ ${amount} was processed from Dwolla but still not added to user: ${user.id} wallet. So, adding it to user's TP wallet via sync transaction cron. ` +
                                            moment().format('DD-MM-YYYY hh:mm:ss a'),
                                    );
                                    const newTopUp = new TopUp();
                                    newTopUp.grossAmount = parseFloat(amount) * 100;
                                    newTopUp.netAmount = parseFloat(amount) * 100;
                                    newTopUp.topUpTransferUrl = transferURL;
                                    newTopUp.userId = user.id;
                                    const eventUrl = transferURL;
                                    await this.paymentGatewayEventRepository.create({
                                        eventUrl,
                                        topic: 'customer_bank_transfer_completed',
                                        eventId,
                                    });
                                    await this.topUpRepository.create(newTopUp);
                                    logger.info(
                                        `Add funds Transfer id:  ${eventId} of amount $ ${amount} added to user: ${user.id} wallet. ` +
                                            moment().format('DD-MM-YYYY hh:mm:ss a'),
                                    );
                                }
                            }
                        });
                }),
        );
    }

    async updateIncorrectProjectionContests() {
        /*
        Date: 2-01-2022
        Description: This was run to update projection data for contests that were created based on incorrect projections */

        const contests = await this.contestRepository.find({
            where: {
                and: [
                    { createdAt: { gt: '2021-12-29 00:00:00' } },
                    { createdAt: { lt: '2022-01-02 14:00:00' } },
                    { ended: false },
                ],
            },
        });
        // const sql =
        //     "select * from contest where createdat>'2021-12-29 00:00:00' and createdat<'2022-01-02 21:57:0' and ended=false";

        // const contests = await this.contestRepository.execute(sql, null, null);

        contests.map(async (contest: any) => {
            const contestId = contest.id;
            const creatorPlayerId = contest.creatorPlayerId;
            const claimerPlayerId = contest.claimerPlayerId;

            // const creatorPlayerProjectedFantasyPoints = creatorPlayer.projectedFantasyPointsHalfPpr;
            // const claimerPlayerProjectedFantasyPoints = claimerPlayer.projectedFantasyPointsHalfPpr;

            const winBonusFlag = false;
            const entryAmount = contest.entryAmount;
            const creatorPlayerSpread = await this.contestService.calculateSpread(
                creatorPlayerId,
                claimerPlayerId,
                'creator',
            );

            if (creatorPlayerSpread !== contest.creatorPlayerSpread) {
                if (Math.abs(creatorPlayerSpread) > 6.5) {
                    logger.info(
                        `Contest with id ${contestId} has been voided because spread is too large ${creatorPlayerSpread}`,
                    );
                    await this.cronServie.closeContestsFromList([contest]);
                } else {
                    const creatorPlayerData = await this.playerRepository.findById(creatorPlayerId);
                    const claimerPlayerData = await this.playerRepository.findById(claimerPlayerId);

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

                    const creatorPlayerProjFantasyPoints = creatorPlayerData
                        ? creatorPlayerData.projectedFantasyPointsHalfPpr
                        : 0;
                    const claimerPlayerProjFantasyPoints = claimerPlayerData
                        ? claimerPlayerData.projectedFantasyPointsHalfPpr
                        : 0;

                    const creatorPlayerMaxWin = Number(creatorPlayerCover) + Number(creatorPlayerWinBonus);
                    const claimerPlayerMaxWin = Number(claimerPlayerCover) + Number(claimerPlayerWinBonus);

                    contest.creatorPlayerProjFantasyPoints = creatorPlayerProjFantasyPoints;
                    contest.claimerPlayerProjFantasyPoints = claimerPlayerProjFantasyPoints;
                    contest.creatorPlayerCover = creatorPlayerCover;
                    contest.claimerPlayerCover = claimerPlayerCover;
                    contest.creatorPlayerMaxWin = creatorPlayerMaxWin;
                    contest.claimerPlayerMaxWin = claimerPlayerMaxWin;
                    contest.creatorPlayerWinBonus = creatorPlayerWinBonus;
                    contest.claimerPlayerWinBonus = claimerPlayerWinBonus;
                    contest.creatorPlayerSpread = creatorPlayerSpread;
                    contest.claimerPlayerSpread = claimerPlayerSpread;

                    const updatedContest = await this.contestRepository.updateById(contestId, contest);
                    logger.info(`Contest with id ${contestId} has been updated because of incorrect projections`);
                }
            }
        });
    }

    // Remove all promo codes in the system
    async removePromoCodes() {
        /* Date:20-01-2022
         */

        const sql = 'TRUNCATE couponcode RESTART IDENTITY';

        await this.couponCodeRepository.execute(sql, null, null);
        logger.info(`Coupon Codes have been cleared`);
    }
}
