import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module'; 
import { UsersModule } from './users/users.module'; 
import { CartModule } from './cart/cart.module'; 
import { EnderecosModule } from './enderecos/enderecos.module'; 
import { Encomendas } from './encomendas/encomendas.entity'; 
import { EncomendaItens } from './encomendas/encomenda-itens.entity';
import { Usuarios } from './users/usuarios.entity';
import { Enderecos } from './enderecos/enderecos.entity';

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
        entities: [
          Usuarios,
          Encomendas, 
          EncomendaItens,
          Enderecos,
        ],
        ssl: {
          rejectUnauthorized: false, 
        },
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    
    SupabaseModule, 
    AuthModule, 
    UsersModule, 
    CartModule,
    EnderecosModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}