// src/app.module.ts (Adicione imports e o TypeOrmModule)
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm'; // Novo import
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module'; 
import { UsersModule } from './users/users.module'; 
import { Encomendas } from './encomendas/encomendas.entity'; // Novo import
import { EncomendaItens } from './encomendas/encomenda-itens.entity'; // Novo import
import { CartModule } from './cart/cart.module'; // Novo import
import { Usuarios } from './users/usuarios.entity'; // 👈 Certifique-se de importar Usuarios!
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 🚨 Configuração TypeORM 🚨
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
            // Adicione outras entidades aqui (Ex: Produtos, Usuarios, Enderecos)
        ],
        // No Supabase, SSL/TLS é geralmente obrigatório
        ssl: {
          rejectUnauthorized: false, 
        },
        synchronize: false, // Mantenha false em produção! O Supabase gerencia o schema.
      }),
      inject: [ConfigService],
    }),
    // Fim da configuração TypeORM
    
    SupabaseModule, 
    AuthModule, 
    UsersModule, 
    CartModule // Novo
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}