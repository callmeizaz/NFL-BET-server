import { service } from '@loopback/core';
import { CronJob, cronJob } from '@loopback/cron';
import { CronService } from '@src/services';
import { CRON_JOBS } from '@src/utils/constants';
import chalk from 'chalk';
import cron from 'cron';
import { CSV_DEDUCT_FUNDS_TIMING } from '../utils/cron-timings';
import logger from '../utils/logger';

@cronJob()
export class DeductFundsCron extends CronJob {
    constructor(@service() private cronService: CronService) {
        super({
            cronTime: CSV_DEDUCT_FUNDS_TIMING,
            name: CRON_JOBS.DEDUCT_FUNDS_CRON,
            start: true,
            onTick: async () => {
                try {
                    await this.cronService.deductFunds();
                    await this.cronService.cronLogger(CRON_JOBS.DEDUCT_FUNDS_CRON);

                    const updatedCronTiming = await this.cronService.updatedCronConfig(CRON_JOBS.DEDUCT_FUNDS_CRON);
                    const updatedCronTime = new cron.CronTime(updatedCronTiming);
                    this.setTime(updatedCronTime);
                    this.start();
                } catch (error) {
                    logger.error(chalk.redBright(`Error on deduct funds cron job. Error: `, error));
                }
            },
        });
    }
}
