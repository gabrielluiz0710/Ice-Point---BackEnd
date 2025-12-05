import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module'; 
import { UsersModule } from './users/users.module'; 
import { ProductsModule } from './products/products.module';

import { CartModule } from './cart/cart.module'; 
import { EnderecosModule } from './enderecos/enderecos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false, 

        ssl: {
          rejectUnauthorized: false, 
        },

        extra: {
          max: 20, 
          connectionTimeoutMillis: 40000, 
          idleTimeoutMillis: 30000, 
          keepAlive: true, 
        },
      }),
      inject: [ConfigService],
    }),
    SupabaseModule, 
    AuthModule, 
    UsersModule, 
    CartModule,
    EnderecosModule,
    ProductsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}